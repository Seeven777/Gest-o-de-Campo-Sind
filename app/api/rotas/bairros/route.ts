import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const reply=(payload:unknown,status=200)=>NextResponse.json(payload,{status,headers:{'Cache-Control':'no-store'}});
/** Somente gestores: municípios e bairros presentes na base operacional. */
export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return reply({error:'Faça login novamente.'},401);
 if(!['admin','supervisor'].includes(user.role))return reply({error:'Planejamento reservado à central.'},403);
 const city=(new URL(req.url).searchParams.get('city')||'').trim().slice(0,120);
 if(!city){
  const rows=await db().query(`select min(trim(city)) as name,count(*)::int as count
   from establishments where nullif(trim(city),'') is not null
   group by lower(unaccent(trim(city))) order by name limit 1000`);
  return reply({cities:rows});
 }
 const rows=await db().query(`select min(trim(district)) as name,count(*)::int as count
  from establishments
  where lower(unaccent(trim(coalesce(city,''))))=lower(unaccent(trim($1)))
   and nullif(trim(district),'') is not null
  group by lower(unaccent(trim(district))) order by name limit 1500`,[city]);
 return reply({districts:rows,city});
}
