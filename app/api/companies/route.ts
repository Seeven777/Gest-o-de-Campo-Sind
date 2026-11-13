import {db} from '@/lib/db';
import {withRole} from '@/lib/api';
import {isSchemaReady} from '@/lib/schema-readiness';
import {validISODate} from '@/lib/iso-date';
export const dynamic='force-dynamic';

export async function GET(req:Request){
 return withRole(['admin','supervisor','agent'],async user=>{
  const url=new URL(req.url),term=(url.searchParams.get('q')||'').trim().slice(0,120);
  const planning=url.searchParams.get('purpose')==='route'&&['admin','supervisor'].includes(user.role);
  const registrationReady=planning?false:await isSchemaReady('cadastro');
  const rawPage=Number(url.searchParams.get('page')||1);
  const page=Number.isInteger(rawPage)?Math.max(1,Math.min(10000,rawPage)):1;
  const city=(url.searchParams.get('city')||'').trim().slice(0,120);
  const district=(url.searchParams.get('district')||'').trim().slice(0,120);
  const cnae=(url.searchParams.get('cnae')||'').replace(/\D/g,'').slice(0,7);
  const status=(url.searchParams.get('status')||'').trim();
  const availableOn=(url.searchParams.get('available_on')||'').trim();
  const exceptRoute=(url.searchParams.get('except_route')||'').trim();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(availableOn&&!validISODate(availableOn))return {error:'Data de planejamento inválida.'};
  if(exceptRoute&&!uuid.test(exceptRoute))return {error:'Rota inválida.'};
  if(status&&!['pending','validated','review','invalid'].includes(status))
   return {error:'Filtro de situação inválido.'};
  const limit=25,offset=(page-1)*limit;
  const scope=user.role==='agent'
   ?"and exists (select 1 from route_stops rs join routes r on r.id=rs.route_id where rs.establishment_id=e.id and r.agent_id=$7 and r.status in ('published','in_progress','completed'))"
   :"";
  // Enquanto o Neon não tiver a migração 008, não exibir confirmação presumida.
  const districtParam=user.role==='agent'?'$8':'$7';
  const availableParam=user.role==='agent'?'$9':'$8';
  const exceptParam=user.role==='agent'?'$10':'$9';
  const registrationExpr=registrationReady
   ?"case when rr.state='confirmed' and rr.official_verified_at is not null and e.field_status='validated' then 'confirmed' else 'pending' end"
   :"'unavailable'::text";
  const rows=await db().query(`select
    e.id,e.cnpj,e.legal_name,e.trade_name,e.city,e.district,e.state,e.field_status,
    ${registrationExpr} as registration_state
    from establishments e
    ${planning?'':"left join registration_records rr on rr.establishment_id=e.id"}
    where ($1='' or upper(e.cnpj) like '%'||upper(regexp_replace($1,'[^A-Za-z0-9]','','g'))||'%' or unaccent(e.legal_name) ilike '%'||unaccent($1)||'%'
     or unaccent(coalesce(e.trade_name,'')) ilike '%'||unaccent($1)||'%'
     or unaccent(coalesce(e.city,'')) ilike '%'||unaccent($1)||'%')
    and ($4='' or (${districtParam}<>'' and lower(unaccent(trim(coalesce(e.city,''))))=lower(unaccent(trim($4))))
      or (${districtParam}='' and unaccent(coalesce(e.city,'')) ilike '%'||unaccent($4)||'%'))
    and ($5='' or e.main_cnae like $5||'%')
    and ($6='' or e.field_status=$6)
    and (${districtParam}='' or lower(unaccent(trim(coalesce(e.district,''))))=lower(unaccent(trim(${districtParam}))))
    and (${availableParam}::date is null or not exists (
     select 1 from route_stops rs join routes route on route.id=rs.route_id
     where rs.establishment_id=e.id and route.route_date=${availableParam}::date
      and route.status<>'cancelled' and (${exceptParam}::uuid is null or route.id<>${exceptParam}::uuid)
    ))
    ${scope} order by e.created_at desc limit $2 offset $3`,
   user.role==='agent'?[term,limit+1,offset,city,cnae,status,user.id,district,null,exceptRoute||null]:[term,limit+1,offset,city,cnae,status,district,availableOn||null,exceptRoute||null]);
  return {items:rows.slice(0,limit),page,hasMore:rows.length>limit,registration_ready:registrationReady};
 });
}
