import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
 const u=await currentIdentity();if(!u)return NextResponse.json({error:'Acesso negado.'},{status:401});
 if(u.role!=='agent')return NextResponse.json({error:'Esta jornada é exclusiva do agente responsável.'},{status:403});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Rota inválida.'},{status:400});
 const [route]=await db().query(`select r.id,r.agent_id,r.route_date,r.status,c.name as campaign_name
 from routes r join campaigns c on c.id=r.campaign_id where r.id=$1`,[id]);
 if(!route||u.role==='agent'&&route.agent_id!==u.id)return NextResponse.json({error:'Rota não autorizada.'},{status:404});
 if(u.role==='agent'&&!['published','in_progress','completed'].includes(route.status))return NextResponse.json({error:'Rota ainda não publicada.'},{status:403});
 const stops=await db().query(`select s.id,s.position_order,e.legal_name,e.trade_name,e.cnpj,e.street,e.street_number,e.city,e.state,e.postal_code,
 st_y(e.position::geometry) as lat,st_x(e.position::geometry) as lon,
 v.id as visit_id,v.checkin_at,v.checkout_at,v.review_status,
 exists(select 1 from visit_evidence ev where ev.visit_id=v.id and ev.deleted_at is null and ev.expires_at>now()) as has_photo
 from route_stops s join establishments e on e.id=s.establishment_id
 left join lateral (select * from visits where stop_id=s.id order by created_at desc limit 1) v on true
 where s.route_id=$1 order by s.position_order`,[id]);
 const [presence]=await db().query('select active,last_seen_at from agent_live_presence where agent_id=$1 and route_id=$2',[route.agent_id,id]);
 return NextResponse.json({route,stops,presence:presence||null},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('[GET /api/campo/:id]',error);
  return NextResponse.json(
   {error:'A central não conseguiu consultar esta jornada. Tente novamente em instantes.'},
   {status:503,headers:{'Cache-Control':'no-store'}}
  );
 }
}
