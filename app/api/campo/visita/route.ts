import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function POST(req:Request){
 const u=await currentIdentity();if(!u||u.role!=='agent')return fail('Apenas agentes autorizados podem registrar a visita.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem inválida.',403);
 const data=await req.json().catch(()=>({})) as Record<string,unknown>;
 const action=String(data.action||''),stop=String(data.stop_id||'');
 if(!uuid.test(stop)||!['arrive','finish'].includes(action))return fail('Etapa de visita inválida.');
 const [assigned]=await db().query(`select s.id,s.route_id,r.status,e.legal_name from route_stops s join routes r on r.id=s.route_id join establishments e on e.id=s.establishment_id
 where s.id=$1 and r.agent_id=$2 and r.status in ('published','in_progress')`,[stop,u.id]);
 if(!assigned)return fail('Empresa não atribuída a uma rota ativa.',403);
 if(action==='arrive'){
  if(typeof data.lat!=='number'||typeof data.lon!=='number'||typeof data.accuracy!=='number')return fail('Não recebemos uma posição GPS válida. Atualize sua localização e tente novamente.');
  const lat=data.lat,lon=data.lon,accuracy=data.accuracy;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000)return fail('Ative o GPS e tente confirmar novamente.');
  // A alteração condicional do status bloqueia a parada durante o check-in.
  // Duas solicitações concorrentes não podem registrar a mesma chegada.
  const rows=await db().query(`with claimed as (
   update route_stops s set status='arrived'
   where s.id=$1 and s.status='pending'
     and exists (select 1 from routes r where r.id=s.route_id and r.agent_id=$2
                 and r.status in ('published','in_progress'))
     and not exists (select 1 from visits v where v.stop_id=s.id)
   returning s.id
  ), registered as (
   insert into visits(stop_id,agent_id,checkin_at,checkin_position,accuracy_m)
   select id,$2,now(),ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,$5 from claimed
   returning id
  ), audited as (
   insert into audit_logs(actor_id,action,details)
   select $2,'field.arrived',jsonb_build_object('stop_id',$1::uuid) from registered
   returning id
  ) select registered.id from registered join audited on true`,[stop,u.id,lat,lon,accuracy]);
  if(!rows.length)return fail('Já existe registro para esta parada. Atualize a jornada.',409);
  return NextResponse.json({id:rows[0].id});
 }
 const visit=String(data.visit_id||'');
 if(!uuid.test(visit))return fail('Visita inválida.');
 const operating=String(data.operating_status||'');
 const signage=String(data.signage_status||'');
 const regularity=String(data.regularity_note||'');
 const addressMatch=String(data.address_match||'');
 const petActivity=String(data.pet_activity_match||'');
 const notes=String(data.notes||'').trim();
 if(!['operating','closed','moved','not_found','unknown'].includes(operating)||!['yes','no','unknown'].includes(signage)||!['none_observed','attention','not_evaluated'].includes(regularity)||!['yes','no','unknown'].includes(addressMatch)||!['yes','no','unknown'].includes(petActivity)||notes.length>2000)return fail('Responda às cinco perguntas para enviar a visita.');
 const [evidence]=await db().query('select id from visit_evidence where visit_id=$1 and deleted_at is null and expires_at>now() limit 1',[visit]);
 if(!evidence)return fail('Antes de finalizar, fotografe a fachada da empresa.',409);
 const result=operating==='operating'?'located':operating==='closed'?'closed':operating==='moved'?'moved':operating==='not_found'?'not_found':'not_completed';
 // A última visita encerra a rota considerando checkouts reais, inclusive se
 // versões antigas deixaram route_stops.status incorreto. A operação é atômica.
 const rows=await db().query(`with completed as (
   update visits set checkout_at=now(),result=$4,notes=$5,operating_status=$6,
    signage_status=$7,regularity_note=$8,address_match=$9,pet_activity_match=$10,
    form_submitted_at=now(),review_status='pending',reviewed_at=null,reviewed_by=null,review_notes=null
   where id=$1 and stop_id=$2 and agent_id=$3 and checkout_at is null and checkin_at is not null
   returning id,stop_id
  ), marked as (
   update route_stops s set status='visited' where s.id in (select stop_id from completed)
   returning s.id
  ), closed_route as (
   update routes r set status='completed'
   where r.id=(select s.route_id from route_stops s where s.id=$2)
     and r.agent_id=$3 and r.status in ('published','in_progress')
     and exists (select 1 from marked)
     and not exists (
      select 1 from route_stops other_stop
      where other_stop.route_id=r.id and other_stop.id<>$2
      and not exists (
       select 1 from visits submitted
       where submitted.stop_id=other_stop.id and submitted.checkout_at is not null
      )
     )
   returning r.id
  ), audited as (
   insert into audit_logs(actor_id,action,details)
   select $3,'field.submitted',jsonb_build_object('visit_id',$1::uuid,'result',$4::text) from marked
   returning id
  ) select completed.id,exists(select 1 from closed_route) as route_completed
    from completed join marked on marked.id=completed.stop_id join audited on true`,
  [visit,stop,u.id,result,notes,operating,signage,regularity,addressMatch,petActivity]);
 if(!rows.length)return fail('Visita já finalizada ou fora da sua rota.',409);
 return NextResponse.json({ok:true,id:visit,route_completed:rows[0].route_completed===true});
}
