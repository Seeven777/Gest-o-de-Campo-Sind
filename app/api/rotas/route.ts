import {validISODate} from '@/lib/iso-date';
import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 const user=await currentIdentity();if(!user)return fail('Acesso não autorizado',401);
  if(!['admin','supervisor','agent'].includes(user.role))return fail('Rotas não autorizadas para Cadastro.',403);
 const scope=user.role==='agent'?"where r.agent_id=$1 and r.status in ('published','in_progress','completed')":'';const params=user.role==='agent'?[user.id]:[];
 const items=await db().query(`select r.id,r.route_date,r.status,c.name as campaign_name,p.full_name as agent_name,
 (select count(*)::int from route_stops where route_id=r.id) as stops
 from routes r join campaigns c on c.id=r.campaign_id join app_profiles p on p.auth_user_id=r.agent_id
 ${scope} order by r.route_date desc limit 100`,params);
 return NextResponse.json({items});
}
export async function POST(req:Request){
 const user=await currentIdentity();if(!user||!['admin','supervisor'].includes(user.role))return fail('Somente administração e supervisão.',403);
 const data=await req.json().catch(()=>({}));
 const campaign=String(data.campaign_id||''),agent=String(data.agent_id||''),date=String(data.date||'');
 const stops=Array.isArray(data.establishment_ids)?data.establishment_ids.map(String):[];
 if(campaign&&!/^[0-9a-f-]{36}$/i.test(campaign)||!agent||!validISODate(date)||stops.length<1||stops.length>49||new Set(stops).size!==stops.length||stops.some((x:string)=>!/^[0-9a-f-]{36}$/i.test(x)))return fail('Informe responsável, data e de 1 a 49 empresas únicas.');
 const [c]=campaign?await db().query('select id from campaigns where id=$1 and $2::date between start_date and end_date and status<>\'cancelled\'',[campaign,date]):[{id:'automatic'}];
 const [a]=await db().query('select auth_user_id from app_profiles where auth_user_id=$1 and role=\'agent\' and is_active=true',[agent]);
 if(!c||!a)return fail('Rota fora do período configurado ou agente não encontrado.');
 const check=await db().query('select id from establishments where id=ANY($1::uuid[])',[stops]);if(check.length!==stops.length)return fail('Há empresas inexistentes na seleção.');
 const dup=await db().query(`select 1 from routes r join route_stops s on s.route_id=r.id
 where r.route_date=$1 and r.status<>'cancelled' and s.establishment_id=ANY($2::uuid[]) limit 1`,[date,stops]);
 if(dup.length)return fail('Uma das empresas já consta em outra rota ativa nessa data.',409);
 // A rota e todas as paradas são gravadas em um único comando atômico.
 // Uma falha intermediária não deixa rota incompleta, inclusive com até 49 empresas.
 const [route]=await db().query(`with automatic_campaign as (
   insert into campaigns(name,start_date,end_date,status,created_by)
   select 'Rota de '||to_char($3::date,'DD/MM/YYYY'),$3::date,$3::date,'draft',$5
   where $1::uuid is null returning id
 ), new_route as (
   insert into routes(campaign_id,agent_id,route_date,status)
   values(coalesce((select id from automatic_campaign),$1::uuid),$2,$3,'draft') returning id
 ), new_stops as (
   insert into route_stops(route_id,establishment_id,position_order)
   select new_route.id,item.establishment_id,item.ordinality::int
   from new_route cross join unnest($4::uuid[]) with ordinality as item(establishment_id,ordinality)
   returning id
 ) select new_route.id,(select count(*)::int from new_stops) as count from new_route`,
 [campaign||null,agent,date,stops,user.id]);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[user.id,'route.created',JSON.stringify({id:route.id,count:stops.length})]);
 return NextResponse.json({id:route.id,count:stops.length});
}

export async function PATCH(req:Request){
 const u=await currentIdentity();if(!u||!['admin','supervisor'].includes(u.role))return fail('Apenas administração e supervisão.',403);
 const data=await req.json().catch(()=>({}));const id=String(data.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return fail('Rota inválida.');
 const rows=await db().query("update routes set status='published' where id=$1 and status='draft' and exists(select 1 from route_stops where route_id=$1) returning id",[id]);
 if(!rows.length)return fail('A rota deve existir, possuir paradas e estar em rascunho.',409);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'route.published',JSON.stringify({route_id:id})]);
 return NextResponse.json({ok:true});
}
