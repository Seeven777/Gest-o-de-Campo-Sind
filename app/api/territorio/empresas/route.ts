import {validISODate} from '@/lib/iso-date';
import {isSchemaReady,schemaPendingMessage} from '@/lib/schema-readiness';
import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return NextResponse.json({error:'Sessão expirada.'},{status:401});
 if(!['admin','supervisor'].includes(user.role))return NextResponse.json({error:'Acesso restrito.'},{status:403});
 if(!(await isSchemaReady('cadastro')))return NextResponse.json({error:schemaPendingMessage('cadastro')},{status:503});
 const qs=new URL(req.url).searchParams,city=(qs.get('city')||'').trim().slice(0,100);
 const from=qs.get('from')||'',to=qs.get('to')||'',page=Math.max(1,Math.min(100,Number(qs.get('page'))||1));
 if(!city||!/^[\p{L}\p{M}\s.'()-]+$/u.test(city)||from&&!validISODate(from)||to&&!validISODate(to)||from&&to&&from>to)return NextResponse.json({error:'Filtro inválido.'},{status:400});
 const rows=await db().query(`select e.id,e.cnpj,e.legal_name,e.trade_name,e.city,e.field_status,
 case when e.field_status='validated' and rr.state='confirmed' and rr.confirmed_at is not null and rr.official_verified_at is not null then true else false end as registered
 from establishments e left join registration_records rr on rr.establishment_id=e.id
 where unaccent(lower(trim(e.city)))=unaccent(lower($1))
 and (e.state is null or upper(e.state)='SP')
 and ($2::date is null or e.created_at >= $2::date)
 and ($3::date is null or e.created_at < ($3::date+interval '1 day'))
 order by e.created_at desc limit 51 offset $4`,[city,from||null,to||null,(page-1)*50]);
 return NextResponse.json({items:rows.slice(0,50),hasMore:rows.length>50,page},{headers:{'Cache-Control':'no-store'}});
}
