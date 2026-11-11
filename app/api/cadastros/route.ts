import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(req:Request){const user=await currentIdentity();if(!user||user.role==='agent')return fail('Acesso restrito',403);
 const q=(new URL(req.url).searchParams.get('q')||'').slice(0,100).trim();
 const rows=await db().query(`select e.id,e.cnpj,e.legal_name,e.trade_name,e.city,e.field_status,coalesce(rr.state,'pending') registration_state,rr.reference,rr.confirmed_at
 from establishments e join registration_records rr on rr.establishment_id=e.id
 where e.field_status='validated' and rr.state='confirmed' and rr.confirmed_at is not null
 and ($1='' or e.cnpj like '%'||$1||'%' or e.legal_name ilike '%'||$1||'%' or coalesce(e.city,'') ilike '%'||$1||'%')
 order by rr.confirmed_at desc limit 100`,[q]);
 return NextResponse.json({items:rows});}
export async function POST(req:Request){const user=await currentIdentity();if(!user||user.role!=='admin')return fail('A confirmação sindical é exclusiva da administração.',403);
 const d=await req.json().catch(()=>({})),id=String(d.establishment_id||''),state=String(d.state||''),reference=String(d.reference||'').trim().slice(0,200);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['confirmed','rejected','pending'].includes(state)||state==='confirmed'&&!reference)return fail('Informe a empresa, a situação e a referência interna do cadastro.');
 const exists=await db().query('select id,field_status from establishments where id=$1',[id]);if(!exists.length)return fail('Empresa não encontrada',404);
 if(state==='confirmed'&&exists[0].field_status!=='validated')return fail('Confirme o cadastro somente após a validação da empresa em campo.',409);
 await db().query(`insert into registration_records(establishment_id,state,reference,confirmed_by,confirmed_at,updated_at)
 values($1,$2,$3,$4,case when $2='confirmed' then now() else null end,now())
 on conflict(establishment_id) do update set state=excluded.state,reference=excluded.reference,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,updated_at=now()`,[id,state,reference,user.id]);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[user.id,'registration.manual_status',JSON.stringify({id,state,reference})]);
 return NextResponse.json({ok:true});
}
