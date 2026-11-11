import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentIdentity();if(!user)return NextResponse.json({error:'Entre em sua conta'},{status:401});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Rota inválida'},{status:400});
 const [route]=await db().query('select r.id,r.agent_id,r.route_date,r.status,c.name campaign_name from routes r join campaigns c on c.id=r.campaign_id where r.id=$1',[id]);
 if(!route||(user.role==='agent'&&(route.agent_id!==user.id||!['published','in_progress','completed'].includes(route.status))))return NextResponse.json({error:'Rota não encontrada'},{status:404});
 const stops=await db().query(`select s.id,s.position_order,s.status,e.id as establishment_id,e.cnpj,e.legal_name,e.trade_name,e.street,e.street_number,e.city,e.state,e.postal_code from route_stops s join establishments e on e.id=s.establishment_id where s.route_id=$1 order by s.position_order`,[id]);
 return NextResponse.json({route,stops});
}
