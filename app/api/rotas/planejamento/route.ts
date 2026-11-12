import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
import {validISODate} from '@/lib/iso-date';
import {evaluateRoute,rankCandidates,type Location} from '@/lib/route-proximity';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const user=await currentIdentity();if(!user)return fail('Faça login novamente.',401);
 if(!['admin','supervisor'].includes(user.role))return fail('Planejamento reservado à administração e supervisão.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const p=await req.json().catch(()=>({}));
 const ids=p?.establishment_ids,date=String(p?.date||''),routeId=String(p?.route_id||'');
 if(!Array.isArray(ids)||ids.length<1||ids.length>49||ids.some((x:unknown)=>typeof x!=='string'||!uuid.test(x))||new Set(ids).size!==ids.length)
  return fail('Selecione entre 1 e 49 empresas diferentes.');
 if(date&&!validISODate(date))return fail('Data inválida.');
 if(routeId&&!uuid.test(routeId))return fail('Rota inválida.');
 const rows=await db().query(`select id::text,legal_name,trade_name,city,district,postal_code,
 ST_Y(position::geometry) as lat,ST_X(position::geometry) as lon
 from establishments where id=any($1::uuid[])`,[ids]) as Location[];
 if(rows.length!==ids.length)return fail('Uma empresa não existe mais na base. Atualize a seleção.',409);
 const byId=new Map(rows.map(x=>[x.id,x]));
 const selected=ids.map((id:string)=>byId.get(id)!);
 const assessment=evaluateRoute(selected);
 const cities=[...new Set(selected.map(s=>String(s.city||'').toLowerCase().trim()).filter(Boolean))];
 if(!cities.length&&!assessment.located)return NextResponse.json({assessment,suggestions:[],basis:'sem_localizacao'},{
  headers:{'Cache-Control':'no-store'}
 });
 const candidates=await db().query(`select e.id::text,e.legal_name,e.trade_name,e.city,e.district,e.postal_code,
 ST_Y(e.position::geometry) as lat,ST_X(e.position::geometry) as lon
 from establishments e
 where e.id<>all($1::uuid[]) and e.field_status<>'invalid'
 and (
  lower(coalesce(e.city,''))=any($2::text[])
  or (e.position is not null and exists(
   select 1 from establishments s where s.id=any($1::uuid[]) and s.position is not null
   and ST_DWithin(e.position,s.position,20000)))
 )
 and ($3::date is null or not exists(
  select 1 from route_stops rs join routes r on r.id=rs.route_id
  where rs.establishment_id=e.id and r.route_date=$3::date
   and r.status<>'cancelled' and ($4::uuid is null or r.id<>$4::uuid)
 ))
 order by
 case when exists(
  select 1 from establishments s where s.id=any($1::uuid[])
  and s.city=e.city and e.postal_code is not null and s.postal_code is not null
  and left(regexp_replace(e.postal_code,'[^0-9]','','g'),5)=left(regexp_replace(s.postal_code,'[^0-9]','','g'),5)
 ) then 0 else 1 end,
 e.city,e.legal_name limit 150`,[ids,cities,date||null,routeId||null]) as Location[];
 return NextResponse.json({assessment,suggestions:rankCandidates(selected,candidates,12),
  basis:assessment.located===selected.length?'coordenadas':'mista'},
  {headers:{'Cache-Control':'no-store'}});
}
