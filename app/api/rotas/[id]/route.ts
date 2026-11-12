import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentIdentity();if(!user)return NextResponse.json({error:'Entre em sua conta'},{status:401});
 if(!['admin','supervisor','agent'].includes(user.role))return NextResponse.json({error:'Rota restrita à equipe operacional.'},{status:403});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Rota inválida'},{status:400});
 const [route]=await db().query(`select r.id,r.agent_id,r.route_date,c.name campaign_name,
 case when progress.total_stops>0 and progress.remaining_stops=0 then 'completed'
      when r.status='completed' and progress.remaining_stops>0 then 'in_progress'
      else r.status end as status
 from routes r join campaigns c on c.id=r.campaign_id
 cross join lateral (
  select count(s.id)::int total_stops,
   count(s.id) filter (where v.done is null)::int remaining_stops
  from route_stops s
  left join lateral (select true as done from visits v
   where v.stop_id=s.id and v.checkout_at is not null limit 1) v on true
  where s.route_id=r.id
 ) progress
 where r.id=$1`,[id]);
 if(!route||(user.role==='agent'&&(route.agent_id!==user.id||!['published','in_progress','completed'].includes(route.status))))
  return NextResponse.json({error:'Rota não encontrada'},{status:404});
 if(user.role==='agent'&&route.status==='completed')
  return NextResponse.json({error:'Percurso concluído. Acesse suas rotas disponíveis.',completed:true},
   {status:410,headers:{'Cache-Control':'no-store'}});
 const stops=await db().query(`select s.id,s.position_order,s.status,e.id as establishment_id,e.cnpj,e.legal_name,e.trade_name,e.street,e.street_number,e.city,e.state,e.postal_code from route_stops s join establishments e on e.id=s.establishment_id where s.route_id=$1 order by s.position_order`,[id]);
 return NextResponse.json({route,stops});
}
