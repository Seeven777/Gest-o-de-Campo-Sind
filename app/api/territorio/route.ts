import {isSchemaReady,schemaPendingMessage} from '@/lib/schema-readiness';
import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const invalid=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
const dateValid=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d));
export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return invalid('Sua sessão expirou.',401);
 if(!['admin','supervisor'].includes(user.role))return invalid('Acesso restrito à administração e supervisão.',403);
 if(!(await isSchemaReady('cadastro')))return invalid(schemaPendingMessage('cadastro'),503);
 const params=new URL(req.url).searchParams,from=params.get('from')||'',to=params.get('to')||'';
 if(from&&!dateValid(from)||to&&!dateValid(to)||from&&to&&from>to)return invalid('Período inválido.');
 const rows=await db().query(`select coalesce(nullif(trim(e.city),''),'Não informado') as city,
 nullif(trim(e.municipality_ibge::text),'') as ibge_code,
 count(*)::int as total,
 count(*) filter (where e.field_status='validated')::int as validated,
 count(*) filter (where e.field_status='pending')::int as pending,
 count(*) filter (where e.field_status='review')::int as review,
 count(*) filter (where e.field_status='invalid')::int as invalid,
 count(*) filter (where e.field_status='validated' and rr.state='confirmed' and rr.confirmed_at is not null and rr.official_verified_at is not null)::int as registered
 from establishments e left join registration_records rr on rr.establishment_id=e.id
 where (e.state is null or upper(e.state)='SP')
 and ($1::date is null or e.created_at >= $1::date)
 and ($2::date is null or e.created_at < ($2::date+interval '1 day'))
 group by 1,2 order by total desc limit 1600`,[from||null,to||null]);
 return NextResponse.json({items:rows,metric_period:{from:from||null,to:to||null}},{headers:{'Cache-Control':'no-store'}});
}
