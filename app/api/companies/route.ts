import { db } from '@/lib/db';
import { withRole } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(req:Request){return withRole(['admin','supervisor','agent'], async(user)=>{
 const url=new URL(req.url);const term=(url.searchParams.get('q')||'').slice(0,120).trim();const page=Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1));
 const limit=25,offset=(page-1)*limit;
 // Agentes veem somente estabelecimentos com parada atribuída em campanhas.
 const scope=user.role==='agent'?`and exists (select 1 from route_stops rs join routes r on r.id=rs.route_id where rs.establishment_id=e.id and r.agent_id=$4)` : '';
 const query=`select e.id,e.cnpj,e.legal_name,e.trade_name,e.city,e.state,e.field_status from establishments e
   where ($1='' or e.cnpj like '%'||$1||'%' or unaccent(e.legal_name) ilike '%'||unaccent($1)||'%'::text or unaccent(coalesce(e.trade_name,'')) ilike '%'||unaccent($1)||'%' or unaccent(coalesce(e.city,'')) ilike '%'||unaccent($1)||'%')
   ${scope} order by e.created_at desc limit $2 offset $3`;
 const params:userParams= user.role==='agent'?[term,limit,offset,user.id]:[term,limit,offset];
 const rows=await db().query(query,params);
 return {items:rows,page,hasMore:rows.length===limit};
})}
type userParams=(string|number)[];
