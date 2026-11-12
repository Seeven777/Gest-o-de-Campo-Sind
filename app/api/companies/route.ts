import {db} from '@/lib/db';
import {withRole} from '@/lib/api';
import {isSchemaReady} from '@/lib/schema-readiness';
export const dynamic='force-dynamic';

export async function GET(req:Request){
 return withRole(['admin','supervisor','agent'],async user=>{
  const registrationReady=await isSchemaReady('cadastro');
  const url=new URL(req.url),term=(url.searchParams.get('q')||'').trim().slice(0,120);
  const rawPage=Number(url.searchParams.get('page')||1);
  const page=Number.isInteger(rawPage)?Math.max(1,Math.min(10000,rawPage)):1;
  const city=(url.searchParams.get('city')||'').trim().slice(0,120);
  const cnae=(url.searchParams.get('cnae')||'').replace(/\D/g,'').slice(0,7);
  const status=(url.searchParams.get('status')||'').trim();
  if(status&&!['pending','validated','review','invalid'].includes(status))
   return {error:'Filtro de situação inválido.'};
  const limit=25,offset=(page-1)*limit;
  const scope=user.role==='agent'
   ?"and exists (select 1 from route_stops rs join routes r on r.id=rs.route_id where rs.establishment_id=e.id and r.agent_id=$7 and r.status in ('published','in_progress','completed'))"
   :"";
  // Enquanto o Neon não tiver a migração 008, não exibir confirmação presumida.
  const registrationExpr=registrationReady
   ?"case when rr.state='confirmed' and rr.official_verified_at is not null and e.field_status='validated' then 'confirmed' else 'pending' end"
   :"'unavailable'::text";
  const rows=await db().query(`select
    e.id,e.cnpj,e.legal_name,e.trade_name,e.city,e.state,e.field_status,
    ${registrationExpr} as registration_state
    from establishments e
    left join registration_records rr on rr.establishment_id=e.id
    where ($1='' or upper(e.cnpj) like '%'||upper(regexp_replace($1,'[^A-Za-z0-9]','','g'))||'%' or unaccent(e.legal_name) ilike '%'||unaccent($1)||'%'
     or unaccent(coalesce(e.trade_name,'')) ilike '%'||unaccent($1)||'%'
     or unaccent(coalesce(e.city,'')) ilike '%'||unaccent($1)||'%')
    and ($4='' or unaccent(coalesce(e.city,'')) ilike '%'||unaccent($4)||'%')
    and ($5='' or e.main_cnae like $5||'%')
    and ($6='' or e.field_status=$6)
    ${scope} order by e.created_at desc limit $2 offset $3`,
   user.role==='agent'?[term,limit+1,offset,city,cnae,status,user.id]:[term,limit+1,offset,city,cnae,status]);
  return {items:rows.slice(0,limit),page,hasMore:rows.length>limit,registration_ready:registrationReady};
 });
}
