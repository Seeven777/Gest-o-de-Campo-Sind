import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 const user=await currentIdentity();if(!user)return fail('Sem sessão',401);
 if(!['admin','supervisor','agent'].includes(user.role))return fail('Visitas de campo não autorizadas para Cadastro.',403);
 const rows=await db().query(`select v.id,v.stop_id,v.agent_id,v.checkin_at,v.checkout_at,v.result,v.notes,v.review_status,e.legal_name,e.city,p.full_name as agent_name
 from visits v join route_stops s on s.id=v.stop_id join establishments e on e.id=s.establishment_id
 join app_profiles p on p.auth_user_id=v.agent_id
 where ($1::bool=false or v.agent_id=$2) order by v.created_at desc limit 150`,[user.role==='agent',user.id]);
 const stops=await db().query(`select s.id as stop_id,s.position_order,e.legal_name,e.trade_name,e.street,e.street_number,e.city,e.state,r.route_date,
 (select v.checkin_at from visits v where v.stop_id=s.id order by v.created_at desc limit 1) checkin_at,
 (select v.checkout_at from visits v where v.stop_id=s.id order by v.created_at desc limit 1) checkout_at
 from route_stops s join routes r on r.id=s.route_id join establishments e on e.id=s.establishment_id
 where ($1::bool=false or r.agent_id=$2) and r.status in ('published','in_progress','completed') order by r.route_date desc,s.position_order limit 100`,[user.role==='agent',user.id]);
 return NextResponse.json({items:rows,stops});
}
// A entrada legada não pode contornar a fotografia e as respostas obrigatórias.
export async function POST(_req:Request){
 const user=await currentIdentity();if(!user)return fail('Faça login.',401);
 return fail('Use a Jornada Guiada da rota para confirmar chegada, fotografar e enviar a visita.',410);
}
