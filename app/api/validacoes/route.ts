import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){
 const u=await currentIdentity();if(!u||u.role==='agent')return NextResponse.json({error:'Acesso restrito'},{status:403});
 const rows=await db().query(`select v.id,v.checkin_at,v.checkout_at,v.result,v.notes,v.review_status,e.legal_name,e.cnpj,e.city,p.full_name agent_name from visits v join route_stops s on s.id=v.stop_id join establishments e on e.id=s.establishment_id join app_profiles p on p.auth_user_id=v.agent_id where v.checkout_at is not null order by v.created_at desc limit 150`);
 return NextResponse.json({items:rows});
}
export async function PATCH(req:Request){
 const u=await currentIdentity();if(!u||u.role==='agent')return NextResponse.json({error:'Acesso restrito'},{status:403});
 const d=await req.json().catch(()=>({}));const id=String(d.id||''),decision=String(d.decision||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['approved','rejected','needs_more'].includes(decision))return NextResponse.json({error:'Revisão inválida'},{status:400});
 const rows=await db().query(`with changed as (update visits set review_status=$2,reviewed_by=$3,reviewed_at=now() where id=$1 and checkout_at is not null and review_status='pending' returning stop_id,result)
 update establishments e set field_status=case when $2='approved' and changed.result='located' then 'validated' when $2='approved' and changed.result in ('not_found','out_of_scope','moved') then 'invalid' when $2='approved' then 'review' else e.field_status end,updated_at=now()
 from changed join route_stops s on s.id=changed.stop_id where e.id=s.establishment_id returning e.id`,[id,decision,u.id]);
 if(!rows.length)return NextResponse.json({error:'Visita não disponível para revisão ou já analisada.'},{status:409});
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'visit.review',JSON.stringify({id,decision})]);
 return NextResponse.json({ok:true});
}
