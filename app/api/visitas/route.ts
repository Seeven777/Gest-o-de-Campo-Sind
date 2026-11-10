import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 const user=await currentIdentity();if(!user)return fail('Sem sessão',401);
 const rows=await db().query(`select v.id,v.stop_id,v.agent_id,v.checkin_at,v.checkout_at,v.result,v.notes,v.review_status,e.legal_name,e.city,p.full_name as agent_name
 from visits v join route_stops s on s.id=v.stop_id join establishments e on e.id=s.establishment_id
 join app_profiles p on p.auth_user_id=v.agent_id
 where ($1::bool=false or v.agent_id=$2) order by v.created_at desc limit 150`,[user.role==='agent',user.id]);
 const stops=await db().query(`select s.id as stop_id,s.position_order,e.legal_name,e.trade_name,e.street,e.street_number,e.city,e.state,r.route_date,
 (select v.checkin_at from visits v where v.stop_id=s.id order by v.created_at desc limit 1) checkin_at,
 (select v.checkout_at from visits v where v.stop_id=s.id order by v.created_at desc limit 1) checkout_at
 from route_stops s join routes r on r.id=s.route_id join establishments e on e.id=s.establishment_id
 where ($1::bool=false or r.agent_id=$2) order by r.route_date desc,s.position_order limit 100`,[user.role==='agent',user.id]);
 return NextResponse.json({items:rows,stops});
}
export async function POST(req:Request){
 const user=await currentIdentity();if(!user)return fail('Sem sessão',401);
 const data=await req.json().catch(()=>({}));const stop=String(data.stop_id||'');const action=String(data.action||'');
 if(!/^[0-9a-f-]{36}$/i.test(stop)||!['checkin','checkout'].includes(action))return fail('Parada ou operação inválida');
 const [assigned]=await db().query('select r.agent_id,s.id from route_stops s join routes r on r.id=s.route_id where s.id=$1',[stop]);
 if(!assigned)return fail('Parada não encontrada',404);
 if(user.role==='agent'&&assigned.agent_id!==user.id)return fail('Parada não atribuída a você',403);
 const agent=String(assigned.agent_id);
 if(action==='checkin'){
  const lat=Number(data.lat),lng=Number(data.lng),accuracy=Number(data.accuracy);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000)return fail('GPS inválido. Autorize a localização e tente novamente.');
  const rows=await db().query(`insert into visits(stop_id,agent_id,checkin_at,checkin_position,accuracy_m)
 select $1,$2,now(),ST_SetSRID(ST_MakePoint($4,$3),4326)::geography where not exists
 (select 1 from visits where stop_id=$1 and checkout_at is null)
 returning id`,[stop,agent,lat,lng,accuracy]);
  if(!rows.length)return fail('Já existe uma visita em andamento para esta parada.',409);
  return NextResponse.json({id:rows[0].id});
 }
 const result=String(data.result||'');const notes=String(data.notes||'').slice(0,2000);
 const allowed=['located','closed','moved','not_found','out_of_scope','not_completed'];
 if(!allowed.includes(result))return fail('Selecione o resultado da visita.');
 const rows=await db().query(`update visits set checkout_at=now(),result=$3,notes=$4
 where stop_id=$1 and agent_id=$2 and checkout_at is null returning id`,[stop,agent,result,notes]);
 if(!rows.length)return fail('Faça o check-in antes de concluir.',409);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[user.id,'visit.completed',JSON.stringify({stop,result})]);
 return NextResponse.json({id:rows[0].id});
}
