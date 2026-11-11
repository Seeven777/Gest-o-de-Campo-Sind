import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
const bad=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function point(d:Record<string,unknown>){
 if(typeof d.lat!=='number'||typeof d.lon!=='number'||typeof d.accuracy!=='number')return null;
 const lat=d.lat,lon=d.lon,accuracy=d.accuracy;
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000)return null;
 return {lat,lon,accuracy};
}
export async function GET(){
 const u=await currentIdentity();if(!u)return bad('Acesso negado.',401);
 if(u.role==='agent'){
  const rows=await db().query(`select route_id,active,last_seen_at,(active and last_seen_at>now()-interval '2 minutes') fresh
  from agent_live_presence where agent_id=$1`,[u.id]);
  return NextResponse.json({self:rows[0]||null},{headers:{'Cache-Control':'no-store'}});
 }
 if(!['admin','supervisor'].includes(u.role))return bad('Acesso reservado à central.',403);
 const items=await db().query(`select p.agent_id,p.route_id,pr.full_name as name,p.accuracy_m,p.last_seen_at,
 ST_Y(p.last_position::geometry) as lat,ST_X(p.last_position::geometry) as lon,
 c.name as campaign
 from agent_live_presence p join app_profiles pr on pr.auth_user_id=p.agent_id
 join routes r on r.id=p.route_id join campaigns c on c.id=r.campaign_id
 where p.active=true and p.last_seen_at>now()-interval '2 minutes' and p.last_position is not null
 and pr.is_active=true order by p.last_seen_at desc limit 150`);
 return NextResponse.json({items},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 const u=await currentIdentity();if(!u||u.role!=='agent')return bad('Somente agentes podem transmitir seu próprio GPS.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return bad('Origem inválida.',403);
 const d=await req.json().catch(()=>({})) as Record<string,unknown>;
 const action=String(d.action||'');
 if(action==='stop'){
  // A parada pertence à rota que abriu o monitoramento: um beacon antigo não
  // pode encerrar o GPS de uma rota iniciada logo em seguida.
  const expected=String(d.route_id||'');
  if(expected&&!uuid.test(expected))return bad('Rota inválida.',400);
  const rows=await db().query(`update agent_live_presence set active=false,last_position=null,accuracy_m=null,stopped_at=now(),updated_at=now()
   where agent_id=$1 and active=true and ($2::uuid is null or route_id=$2::uuid) returning route_id`,[u.id,expected||null]);
  if(rows.length)await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'gps.stopped',JSON.stringify({route_id:rows[0].route_id})]);
  return NextResponse.json({active:false,stopped:rows.length>0});
 }
 const route=String(d.route_id||'');
 if(!uuid.test(route))return bad('Selecione uma rota válida.');
 const [r]=await db().query(`select id,status from routes where id=$1 and agent_id=$2 and status in ('published','in_progress')`,[route,u.id]);
 if(!r)return bad('A rota não está atribuída ou publicada.',403);
 const p=point(d);if(!p)return bad('GPS inválido. Ative a localização precisa e tente novamente.');
 if(action==='start'){
  if(d.consent!==true)return bad('É necessário autorizar o acompanhamento durante a jornada.',403);
  await db().query(`insert into agent_live_presence(agent_id,route_id,active,consent_at,started_at,last_seen_at,last_position,accuracy_m)
  values($1,$2,true,now(),now(),now(),ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,$5)
  on conflict(agent_id) do update set route_id=excluded.route_id,active=true,consent_at=now(),started_at=now(),stopped_at=null,
  last_seen_at=now(),last_position=excluded.last_position,accuracy_m=excluded.accuracy_m,updated_at=now()`,
  [u.id,route,p.lat,p.lon,p.accuracy]);
  await db().query(`update routes set status='in_progress' where id=$1 and agent_id=$2 and status='published'`,[route,u.id]);
  await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'gps.started',JSON.stringify({route_id:route})]);
  return NextResponse.json({active:true});
 }
 if(action!=='ping')return bad('Ação inválida.');
 const rows=await db().query(`update agent_live_presence set last_seen_at=now(),
  last_position=ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,accuracy_m=$5,updated_at=now()
  where agent_id=$1 and route_id=$2 and active=true and last_seen_at>now()-interval '15 minutes'
  and (last_seen_at is null or last_seen_at<now()-interval '10 seconds') returning agent_id`,
  [u.id,route,p.lat,p.lon,p.accuracy]);
 if(!rows.length){
  const [state]=await db().query(`select active,last_seen_at>now()-interval '15 minutes' as fresh
   from agent_live_presence where agent_id=$1 and route_id=$2`,[u.id,route]);
  if(!state?.active||!state.fresh)return bad('Localização encerrada ou expirada. Inicie novamente com consentimento.',409);
  // Um ping antes do intervalo mínimo é ignorado sem fingir que houve atualização.
  return NextResponse.json({active:true,unchanged:true});
 }
 return NextResponse.json({active:true});
}
