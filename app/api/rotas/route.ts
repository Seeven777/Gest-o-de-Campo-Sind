import {validISODate} from '@/lib/iso-date';
import {assessNeighborhoodSelection} from '@/lib/route-neighborhood';
import {evaluateRoute,type Location} from '@/lib/route-proximity';
import {requiresTerritoryConfirmation,validPublicationConfirmation} from '@/lib/route-publication';
import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 const user=await currentIdentity();
 if(!user)return fail('Acesso não autorizado',401);
 if(!['admin','supervisor','agent'].includes(user.role))return fail('Rotas não autorizadas para este cargo.',403);
 // Considera a efetiva finalização de cada visita, mesmo quando estados antigos de
 // route_stops e routes não foram atualizados por versões anteriores da aplicação.
 const scope=user.role==='agent'
  ?"where r.agent_id=$1 and r.status in ('published','in_progress','completed') and progress.remaining_stops>0"
  :"where r.status<>'cancelled'";
 const params=user.role==='agent'?[user.id]:[];
 const items=await db().query(`select r.id,r.route_date,
 case when progress.total_stops>0 and progress.remaining_stops=0 then 'completed'
      when r.status='completed' and progress.remaining_stops>0 then 'in_progress'
      else r.status end as status,
 c.name as campaign_name,p.full_name as agent_name,
 progress.total_stops as stops,
 progress.total_stops-progress.remaining_stops as completed_stops,
 coalesce(area.district_label,'Bairro não informado') as neighborhood_label
 from routes r
 join campaigns c on c.id=r.campaign_id
 join app_profiles p on p.auth_user_id=r.agent_id
 cross join lateral (
  select count(s.id)::int as total_stops,
  count(s.id) filter(where v.done is null)::int as remaining_stops
  from route_stops s
  left join lateral (
   select true as done from visits v
   where v.stop_id=s.id and v.checkout_at is not null limit 1
  ) v on true
  where s.route_id=r.id
 ) progress
 cross join lateral (
  select case
    when count(*)>0 and count(distinct lower(unaccent(trim(coalesce(e.city,'')))))=1
      and count(distinct lower(unaccent(trim(coalesce(e.district,'')))))=1
      and min(nullif(trim(e.city),'')) is not null
      and min(nullif(trim(e.district),'')) is not null
    then min(trim(e.district))||' · '||min(trim(e.city))
    when count(*)>0 then 'Regiões variadas'
    else null end as district_label
  from route_stops s join establishments e on e.id=s.establishment_id where s.route_id=r.id
 ) area
 ${scope} order by r.route_date desc limit 100`,params);
 return NextResponse.json({items},{headers:{'Cache-Control':'no-store'}});
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
 const check=await db().query('select id,city,district from establishments where id=ANY($1::uuid[])',[stops]);if(check.length!==stops.length)return fail('Há empresas inexistentes na seleção.');
 const territory=assessNeighborhoodSelection(check.map(x=>({city:String(x.city||''),district:String(x.district||'')})));
 if(!territory.valid)return fail(territory.reason,409);
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
 const u=await currentIdentity();
 if(!u)return fail('Faça login novamente.',401);
 if(!['admin','supervisor'].includes(u.role))return fail('Apenas administração e supervisão.',403);
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const data=await req.json().catch(()=>({}));const id=String(data.id||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return fail('Rota inválida.');
 try{
  const sql=db();
  // A regra de publicação é verificada no servidor, independentemente da interface.
  const [route]=await sql.query(`select r.status,
   md5(coalesce((select string_agg(s.establishment_id::text,',' order by s.position_order)
    from route_stops s where s.route_id=r.id),'') || ':' || r.status) as edit_token
   from routes r where r.id=$1`,[id]);
  if(!route||route.status!=='draft')return fail('A rota deve estar em rascunho para ser publicada.',409);
  const stops=await sql.query(`select e.id::text,e.legal_name,e.trade_name,e.city,e.district,e.postal_code,
   ST_Y(e.position::geometry) as lat,ST_X(e.position::geometry) as lon
   from route_stops s join establishments e on e.id=s.establishment_id
   where s.route_id=$1 order by s.position_order,s.id`,[id]) as Location[];
  if(!stops.length)return fail('Adicione empresas antes de publicar a rota.',409);
  const assessment=evaluateRoute(stops);
  const needsConfirmation=requiresTerritoryConfirmation(assessment,stops.length);
  if(needsConfirmation&&!validPublicationConfirmation(data.territory_confirmed,data.edit_token,String(route.edit_token))){
   // Confirmação de uma revisão expirada nunca pode ser reutilizada.
   if(data.territory_confirmed===true)return fail('As paradas foram alteradas. Revise a rota novamente antes de confirmar.',409);
   return NextResponse.json({error:'A rota exige revisão territorial antes da publicação.',
    requires_confirmation:true,edit_token:route.edit_token,assessment:{
     risk:assessment.risk,coverage:assessment.coverage,warnings:assessment.warnings,
     cities:assessment.cities,selected:assessment.selected
    }},{status:409,headers:{'Cache-Control':'no-store'}});
  }
  const evidence=JSON.stringify({route_id:id,territory_confirmed:needsConfirmation,
   risk:assessment.risk,coverage:assessment.coverage,municipalities:assessment.cities.length,
   selected:stops.length,warnings:assessment.warnings});
  // O update confere a mesma versão de paradas usada no diagnóstico. O editor de
  // rotas bloqueia o registro de routes antes de alterar as paradas.
  // A auditoria é persistida no mesmo comando SQL, sem falso sucesso parcial.
  const [result]=await sql.query(`with changed as (
   update routes r set status='published'
   where r.id=$1 and r.status='draft'
    and md5(coalesce((select string_agg(s.establishment_id::text,',' order by s.position_order)
     from route_stops s where s.route_id=r.id),'') || ':' || r.status)=$2
    and exists(select 1 from route_stops where route_id=r.id)
    and not exists(select 1 from route_stops s join visits v on v.stop_id=s.id where s.route_id=r.id)
    and not exists(select 1 from agent_live_presence gps where gps.route_id=r.id and gps.active)
   returning r.id
  ), recorded as (
   insert into audit_logs(actor_id,action,details)
   select $3,'route.published',$4::jsonb from changed returning id
  ) select (select count(*)::int from changed) as changed,
    (select count(*)::int from recorded) as recorded`,[id,route.edit_token,u.id,evidence]);
  if(result?.changed!==1||result?.recorded!==1)
   return fail('A rota foi alterada ou a jornada começou. Atualize a página antes de publicar.',409);
  return NextResponse.json({ok:true,territory_confirmed:needsConfirmation},
   {headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('[route-publish]',error instanceof Error?error.message:'Erro inesperado');
  return fail('Não foi possível publicar a rota. Atualize a página e tente novamente.',500);
 }
}
