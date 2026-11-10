import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
import {purgeVisitEvidence} from '@/lib/field-evidence';
export const dynamic='force-dynamic';export const runtime='nodejs';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 const u=await currentIdentity();if(!u||!['admin','supervisor'].includes(u.role))return fail('Acesso restrito à central.',403);
 const rows=await db().query(`select v.id,v.checkin_at,v.checkout_at,v.result,v.notes,v.review_status,v.review_notes,
 v.operating_status,v.signage_status,v.regularity_note,v.accuracy_m,
 case when v.checkin_position is not null and e.position is not null then round(ST_Distance(v.checkin_position,e.position)) else null end as distance_m,
 e.legal_name,e.cnpj,e.city,p.full_name as agent_name,
 (select ev.id from visit_evidence ev where ev.visit_id=v.id and ev.deleted_at is null and ev.expires_at>now() order by ev.uploaded_at desc limit 1) as evidence_id
 from visits v join route_stops s on s.id=v.stop_id
 join establishments e on e.id=s.establishment_id
 join app_profiles p on p.auth_user_id=v.agent_id
 where v.checkout_at is not null order by v.created_at desc limit 150`);
 return NextResponse.json({items:rows},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(req:Request){
 const u=await currentIdentity();if(!u||!['admin','supervisor'].includes(u.role))return fail('Acesso restrito à central.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const d=await req.json().catch(()=>({})) as Record<string,unknown>;
 const id=String(d.id||''),decision=String(d.decision||''),reason=String(d.reason||'').trim().slice(0,1000);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['approved','rejected','needs_more'].includes(decision))return fail('Análise inválida.');
 if(decision!=='approved'&&reason.length<8)return fail('Informe o motivo da recusa ou do pedido de ajustes.');
 const [v]=await db().query(`select v.id,v.form_submitted_at,
 (select count(*)::int from visit_evidence ev where ev.visit_id=v.id and ev.deleted_at is null and ev.expires_at>now()) as photos
 from visits v where v.id=$1 and v.checkout_at is not null and v.review_status='pending'`,[id]);
 if(!v)return fail('A visita já foi analisada ou não foi finalizada.',409);
 if(v.form_submitted_at&&!Number(v.photos)&&decision==='approved')return fail('Não é possível aprovar a visita sem a fotografia da fachada.',409);
 const rows=await db().query(`with changed as (
 update visits set review_status=$2,review_notes=$4,reviewed_by=$3,reviewed_at=now(),
 checkout_at=case when $2='needs_more' then null else checkout_at end
 where id=$1 and checkout_at is not null and review_status='pending' returning stop_id,result
 )
 update establishments e set
 field_status=case
 when $2='approved' and changed.result='located' then 'validated'
 when $2='approved' and changed.result in ('not_found','out_of_scope','moved') then 'invalid'
 when $2='approved' then 'review'
 else e.field_status end,
 updated_at=now()
 from changed join route_stops s on s.id=changed.stop_id
 where e.id=s.establishment_id returning e.id`,[id,decision,u.id,reason]);
 if(!rows.length)return fail('Visita já analisada.',409);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'visit.review',JSON.stringify({visit_id:id,decision})]);
 let cleanup={removed:0,failed:0};
 if(decision!=='needs_more')cleanup=await purgeVisitEvidence(id);
 return NextResponse.json({ok:true,photo_deleted:cleanup.removed>0,cleanup_pending:cleanup.failed>0});
}
