import {assessNeighborhoodSelection} from '@/lib/route-neighborhood';
import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentIdentity();if(!user)return NextResponse.json({error:'Entre em sua conta'},{status:401});
 if(!['admin','supervisor','agent'].includes(user.role))return NextResponse.json({error:'Rota restrita à equipe operacional.'},{status:403});
 const {id}=await params;if(!uuid.test(id))return NextResponse.json({error:'Rota inválida'},{status:400});
 const [route]=await db().query(`select r.id,r.agent_id,r.route_date,c.name campaign_name,r.status as stored_status,
 (r.status in ('draft','published')
  and not exists(select 1 from route_stops es join visits v on v.stop_id=es.id where es.route_id=r.id)
  and not exists(select 1 from agent_live_presence gps where gps.route_id=r.id and gps.active)) as can_edit,
 md5(coalesce((select string_agg(s.establishment_id::text,',' order by s.position_order)
 from route_stops s where s.route_id=r.id),'') || ':' || r.status) as edit_token,
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
 const stops=await db().query(`select s.id,s.position_order,s.status,e.id as establishment_id,e.cnpj,e.legal_name,e.trade_name,e.street,e.street_number,e.district,e.city,e.state,e.postal_code from route_stops s join establishments e on e.id=s.establishment_id where s.route_id=$1 order by s.position_order`,[id]);
 return NextResponse.json({route,stops},{headers:{'Cache-Control':'no-store'}});
}

/**
 * Reorganiza, adiciona e remove empresas de rotas ainda não iniciadas.
 * Todos os passos são atômicos; o token impede sobrescrever outro planejador.
 */
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentIdentity();if(!user)return fail('Faça login novamente.',401);
 if(!['admin','supervisor'].includes(user.role))return fail('Edição restrita à administração e supervisão.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const {id}=await params;if(!uuid.test(id))return fail('Rota inválida.');
 const body=await req.json().catch(()=>({}));
 const ids=body?.establishment_ids,token=String(body?.edit_token||'');
 if(!Array.isArray(ids)||ids.length<1||ids.length>49||ids.some((x:unknown)=>typeof x!=='string'||!uuid.test(x))||new Set(ids).size!==ids.length)
  return fail('Selecione de 1 a 49 empresas diferentes.');
 if(!/^[a-f0-9]{32}$/.test(token))return fail('Atualize a rota antes de editar.',409);
 try {
 const sql=db();
 const [route]=await sql.query(`select r.id,r.route_date::text as route_date,r.status,
 md5(coalesce((select string_agg(s.establishment_id::text,',' order by s.position_order)
  from route_stops s where s.route_id=r.id),'') || ':' || r.status) as edit_token,
 exists(select 1 from route_stops es join visits v on v.stop_id=es.id where es.route_id=r.id) as has_visits,
 exists(select 1 from agent_live_presence gps where gps.route_id=r.id and gps.active) as active_gps
 from routes r where r.id=$1`,[id]);
 if(!route)return fail('Rota não encontrada.',404);
 if(!['draft','published'].includes(String(route.status))||route.has_visits||route.active_gps)
  return fail('A edição só é permitida antes da saída do agente e da primeira visita.',409);
 if(route.edit_token!==token)return fail('Esta rota mudou desde que você a abriu. Atualize a página para evitar sobrescrever alterações.',409);
 const [companies,duplicate]=await Promise.all([
  sql.query('select count(*)::int n from establishments where id=any($1::uuid[])',[ids]),
  sql.query(`select s.establishment_id from route_stops s join routes r on r.id=s.route_id
   where r.id<>$1 and r.route_date=$2::date and r.status<>'cancelled'
   and s.establishment_id=any($3::uuid[]) limit 1`,[id,String(route.route_date).slice(0,10),ids])
 ]);
 if(Number(companies[0]?.n)!==ids.length)return fail('Uma empresa selecionada não existe mais.',409);
 if(duplicate.length)return fail('Uma empresa já está em outra rota ativa na mesma data.',409);
 // Roteiros antigos mistos continuam editáveis. Nos roteiros originalmente
 // organizados por bairro, não permitir misturar regiões ao adicionar paradas.
 const [originalAreas,newAreas]=await Promise.all([
  sql.query(`select e.city,e.district from route_stops s join establishments e on e.id=s.establishment_id where s.route_id=$1`,[id]),
  sql.query('select city,district from establishments where id=any($1::uuid[])',[ids])
 ]);
 if(assessNeighborhoodSelection(originalAreas).valid){
  const areaCheck=assessNeighborhoodSelection(newAreas);
  if(!areaCheck.valid)return fail(areaCheck.reason,409);
 }

 // HTTP transaction: bloqueio da rota + ajuste de posições transitórias (> 1000)
 // + remoção + upsert em ordem + auditoria. Nenhuma visita é alterada.
 const results=await sql.transaction([
  sql.query(`select set_config('app.route_edit_permitted',
   case when exists(
    select 1 from routes r where r.id=$1 and r.status in ('draft','published')
     and not exists(select 1 from route_stops es join visits v on v.stop_id=es.id where es.route_id=r.id)
     and not exists(select 1 from agent_live_presence gps where gps.route_id=r.id and gps.active)
     and md5(coalesce((select string_agg(s.establishment_id::text,',' order by s.position_order)
      from route_stops s where s.route_id=r.id),'') || ':' || r.status)=$2
    for update
   ) then 'yes' else 'no' end,true) as permitted`,[id,token]),
  sql.query(`update route_stops set position_order=position_order+1000 where route_id=$1
   and current_setting('app.route_edit_permitted',true)='yes'`,[id]),
  sql.query(`delete from route_stops where route_id=$1 and establishment_id<>all($2::uuid[])
   and current_setting('app.route_edit_permitted',true)='yes'`,[id,ids]),
  sql.query(`insert into route_stops(route_id,establishment_id,position_order)
   select $1::uuid,item.establishment_id,item.ordinality::int
   from unnest($2::uuid[]) with ordinality as item(establishment_id,ordinality)
   where current_setting('app.route_edit_permitted',true)='yes'
   on conflict(route_id,establishment_id) do update set position_order=excluded.position_order
   returning id`,[id,ids]),
  sql.query(`insert into audit_logs(actor_id,action,details)
   select $1,'route.stops_edited',jsonb_build_object('route_id',$2::uuid,'count',$3::integer,'status',$4::text)
   where current_setting('app.route_edit_permitted',true)='yes'`,[user.id,id,ids.length,route.status])
 ]);
 if(results[0][0]?.permitted!=='yes')return fail('A rota foi modificada ou o agente iniciou a jornada. Atualize a tela.',409);
 if(results[3].length!==ids.length)return fail('Confira a rota: a alteração não retornou todas as paradas.',500);
 return NextResponse.json({ok:true,count:ids.length},{headers:{'Cache-Control':'no-store'}});
 } catch (error) {
  // Sempre responder JSON, inclusive quando Neon rejeita uma consulta.
  // Não expor consultas nem valores internos ao navegador.
  console.error('[route-stops-edit]',error instanceof Error?error.message:'Falha inesperada no Neon.');
  return fail('Não foi possível salvar a rota. Verifique se ela continua em rascunho ou publicada e atualize a página antes de tentar novamente.',500);
 }
}
