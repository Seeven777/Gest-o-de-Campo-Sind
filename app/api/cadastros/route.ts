import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';

export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const canConfirm=(role:string)=>role==='admin'||role==='cadastro';

// Duas etapas independentes: a validação é feita pela supervisão,
// a confirmação sindical é uma conferência humana na base oficial do sindicato.
export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre em sua conta.',401);
 if(!['admin','supervisor','cadastro'].includes(user.role))return fail('Acesso restrito.',403);
 const params=new URL(req.url).searchParams;
 const view=params.get('view')||'confirmed';
 if(!['pending','confirmed'].includes(view))return fail('Situação de cadastro inválida.');
 if(view==='pending'&&!canConfirm(user.role))return fail('Fila de conferência reservada à equipe de Cadastro.',403);
 const q=(params.get('q')||'').slice(0,100).trim();
 const rawPage=Number(params.get('page')||1);
 const page=Number.isInteger(rawPage)?Math.max(1,Math.min(10000,rawPage)):1;
 const limit=30,offset=(page-1)*limit;
 const [rows,stats]=await Promise.all([
  db().query(`select e.id,e.cnpj,e.legal_name,e.trade_name,e.city,e.state,e.field_status,
   e.updated_at as validated_at,coalesce(rr.state,'pending') as registration_state,
   rr.reference,rr.confirmed_at,rr.confirmed_by,p.full_name as confirmed_by_name
   from establishments e
   left join registration_records rr on rr.establishment_id=e.id
   left join app_profiles p on p.auth_user_id=rr.confirmed_by
   where e.field_status='validated'
     and ($1='confirmed' and rr.state='confirmed' and rr.confirmed_at is not null
      or $1='pending' and (rr.state is distinct from 'confirmed' or rr.confirmed_at is null))
     and ($2='' or e.cnpj like '%'||$2||'%'
      or unaccent(e.legal_name) ilike '%'||unaccent($2)||'%'
      or unaccent(coalesce(e.trade_name,'')) ilike '%'||unaccent($2)||'%'
      or unaccent(coalesce(e.city,'')) ilike '%'||unaccent($2)||'%')
   order by case when $1='confirmed' then rr.confirmed_at else e.updated_at end desc,e.id
   limit $3 offset $4`,[view,q,limit+1,offset]),
  db().query(`select
   count(*) filter (where rr.state='confirmed' and rr.confirmed_at is not null)::int confirmed,
   count(*) filter (where rr.state is distinct from 'confirmed' or rr.confirmed_at is null)::int pending
   from establishments e left join registration_records rr on rr.establishment_id=e.id
   where e.field_status='validated'`)
 ]);
 return NextResponse.json({items:rows.slice(0,limit),hasMore:rows.length>limit,page,totals:stats[0]},
  {headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre em sua conta.',401);
 if(!canConfirm(user.role))return fail('A confirmação sindical é restrita ao perfil Cadastro e à administração.',403);
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const data=await req.json().catch(()=>({})) as Record<string,unknown>;
 const id=String(data.establishment_id||'');
 const state=String(data.state||'');
 const reference=String(data.reference||'').trim();
 if(!uuid.test(id)||state!=='confirmed')return fail('Solicitação de confirmação inválida.');
 if(reference.length<3||reference.length>200)return fail('Informe um identificador ou protocolo de 3 a 200 caracteres da base oficial.');
 if(data.officially_checked!==true)return fail('Confirme que o registro foi conferido na base oficial do SindPetshop-SP.');
 // A validação é reavaliada e bloqueada no banco no mesmo comando da confirmação.
 // Registros já confirmados não podem ser sobrescritos acidentalmente por outro operador.
 const rows=await db().query(`with eligible as (
   select id from establishments where id=$1 and field_status='validated' for update
  ), confirmed as (
   insert into registration_records(establishment_id,state,reference,confirmed_by,confirmed_at,updated_at)
   select id,'confirmed',$2,$3,now(),now() from eligible
   on conflict(establishment_id) do update set
    state='confirmed',reference=excluded.reference,confirmed_by=excluded.confirmed_by,
    confirmed_at=excluded.confirmed_at,updated_at=now()
   where registration_records.state is distinct from 'confirmed'
   returning establishment_id,confirmed_at
  ), audited as (
   insert into audit_logs(actor_id,action,details)
   select $3,'registration.officially_confirmed',
    jsonb_build_object('establishment_id',establishment_id,'reference',$2)
   from confirmed returning id
  ) select confirmed.establishment_id,confirmed.confirmed_at from confirmed join audited on true`,
  [id,reference,user.id]);
 if(!rows.length)return fail('Esta empresa não está validada ou já foi confirmada. Atualize a fila.',409);
 return NextResponse.json({ok:true,confirmed_at:rows[0].confirmed_at},{headers:{'Cache-Control':'no-store'}});
}
