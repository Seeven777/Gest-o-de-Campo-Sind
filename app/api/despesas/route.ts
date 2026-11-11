import {isSchemaReady,schemaPendingMessage} from '@/lib/schema-readiness';
import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories=new Set(['fuel','food','toll','parking','lodging','other']);
const paymentMethods=new Set(['pix','transfer','payroll','cash','other']);
const statuses=new Set(['draft','submitted','receipt_received','accounting_review','approved','returned','rejected','paid']);
const textValue=(v:unknown,max=250)=>String(v??'').trim().slice(0,max+1);
const normalCnpj=(v:unknown)=>String(v??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const amountValue=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0&&n<=50000&&Math.abs(n*100-Math.round(n*100))<1e-5?Math.round(n*100)/100:null};
const dateValid=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;};
const protectedResponse={headers:{'Cache-Control':'no-store'}};
const todaySP=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre em sua conta.',401);
 if(!['admin','rh','agent'].includes(user.role))return fail('Reembolsos reservados aos agentes e ao RH.',403);
 if(!(await isSchemaReady('rh')))return fail(schemaPendingMessage('rh'),503);
 const p=new URL(req.url).searchParams;
 const status=p.get('status')||'';
 if(status&&!statuses.has(status))return fail('Situação inválida.');
 const pageValue=Number(p.get('page')||1),page=Number.isInteger(pageValue)?Math.max(1,Math.min(10000,pageValue)):1;
 const owner=user.role==='agent'?user.id:null;
 const [list,summary]=await Promise.all([
  db().query(`select x.id,x.route_id,x.campaign_id,x.agent_id,x.category,x.amount,x.expense_date,x.description,
   x.invoice_reference,x.invoice_recipient_cnpj,x.invoice_issuer_cnpj,x.invoice_access_key,x.approval_status,x.created_at,
   x.receipt_received_at,x.receipt_received_by,x.physical_archive_reference,
   x.accounting_contact,x.accounting_reference,x.accounting_reviewed_at,x.approved_amount,
   x.payment_reference,x.payment_method,x.paid_amount,x.paid_at,x.payment_date,
   x.receipt_acknowledged_at,x.receipt_disputed_at,x.receipt_dispute_reason,
   x.dispute_resolved_at,x.dispute_resolution_reference,x.last_review_note,
   coalesce(c.name,'Rota') campaign_name,p.full_name agent_name,r.route_date
   from expenses x join app_profiles p on p.auth_user_id=x.agent_id
   left join campaigns c on c.id=x.campaign_id
   left join routes r on r.id=x.route_id
   where ($1::text is null or x.agent_id=$1) and ($2='' or x.approval_status=$2)
   order by x.created_at desc,x.id limit 41 offset $3`,[owner,status,(page-1)*40]),
  db().query(`select count(*)::int total,
   count(*) filter(where approval_status in ('submitted','returned'))::int awaiting_paper,
   count(*) filter(where approval_status in ('receipt_received','accounting_review'))::int in_review,
   count(*) filter(where approval_status='approved')::int approved,
   count(*) filter(where approval_status='paid' and receipt_acknowledged_at is null and payment_reference is not null and paid_at is not null)::int awaiting_ack,
   count(*) filter(where approval_status='paid' and (payment_reference is null or paid_at is null))::int legacy_paid,
   count(*) filter(where receipt_disputed_at is not null and dispute_resolved_at is null)::int disputed,
   count(*) filter(where receipt_acknowledged_at is not null)::int acknowledged
   from expenses where ($1::text is null or agent_id=$1)`,[owner])
 ]);
 return NextResponse.json({items:list.slice(0,40),page,hasMore:list.length>40,summary:summary[0]},protectedResponse);
}

export async function POST(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre em sua conta.',401);
 if(user.role!=='agent')return fail('A solicitação de despesa deve ser registrada pelo próprio agente.',403);
 if(!(await isSchemaReady('rh')))return fail(schemaPendingMessage('rh'),503);
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const d=await req.json().catch(()=>({})) as Record<string,unknown>;
 const route=textValue(d.route_id,40),requestId=textValue(d.request_id,40),category=textValue(d.category,30),date=d.expense_date;
 const amount=amountValue(d.amount),description=textValue(d.description,500);
 const invoice=textValue(d.invoice_reference,100),recipient=normalCnpj(d.invoice_recipient_cnpj);
 if(!uuid.test(route)||!uuid.test(requestId)||!categories.has(category)||amount===null||!dateValid(date)||description.length<6||description.length>500)
  return fail('Informe uma rota sua, categoria, data, valor e descrição válida (6 a 500 caracteres).');
 if(String(date)>todaySP())return fail('A despesa deve ter ocorrido na data informada. Não é possível solicitar gasto futuro.');
 if(invoice.length>100||recipient&&recipient.length!==14)return fail('Confira a referência da nota e os 14 caracteres do CNPJ destinatário.');
 const rows=await db().query(`with assigned as (
  select id,campaign_id from routes where id=$1 and agent_id=$2
    and status in ('published','in_progress','completed')
 ), created as (
  insert into expenses(campaign_id,route_id,agent_id,category,amount,expense_date,description,
   invoice_reference,invoice_recipient_cnpj,approval_status,client_request_id)
  select campaign_id,id,$2,$3,$4,$5::date,$6,$7,$8,'submitted',$9::uuid from assigned
  where true on conflict do nothing returning id
 ), tracked as (
  insert into expense_events(expense_id,actor_id,action,before_status,after_status,note,details)
  select id,$2,'submitted',null,'submitted','Solicitação de reembolso registrada',
   jsonb_build_object('route_id',$1,'amount',$4,'category',$3) from created returning id
 ), audited as (
  insert into audit_logs(actor_id,action,details)
  select $2,'expense.submitted',jsonb_build_object('expense_id',id,'route_id',$1) from created returning id
 ) select created.id from created join tracked on true join audited on true`,
 [route,user.id,category,amount,date,description,invoice||null,recipient||null,requestId]);
 if(!rows.length){
  const [existing]=await db().query('select id from expenses where client_request_id=$1 and agent_id=$2 and route_id=$3',[requestId,user.id,route]);
  if(existing)return NextResponse.json({item:existing,already_registered:true,message:'Solicitação já registrada; não foi criada duplicata.'},protectedResponse);
  return fail('Rota não atribuída ou solicitação duplicada. Revise a lista antes de reenviar.',409);
 }
 return NextResponse.json({item:rows[0],message:'Solicitação registrada. Entregue a nota fiscal original ao RH ao retornar.'},{status:201,...protectedResponse});
}

type Change=[string,unknown];
export async function PATCH(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre em sua conta.',401);
 if(!['agent','rh'].includes(user.role))return fail('Somente o agente e o RH podem movimentar reembolsos.',403);
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const d=await req.json().catch(()=>({})) as Record<string,unknown>;
 const id=textValue(d.id,45),action=textValue(d.action,40),note=textValue(d.note,500);
 if(!uuid.test(id))return fail('Solicitação inválida.');
 const [expense]=await db().query(`select id,agent_id,approval_status,amount,approved_amount,payment_reference,paid_at,receipt_disputed_at,dispute_resolved_at,receipt_acknowledged_at
  from expenses where id=$1`,[id]);
 if(!expense)return fail('Despesa não encontrada.',404);
 const isAgent=user.role==='agent';
 if(isAgent&&expense.agent_id!==user.id)return fail('Você não pode alterar despesas de outro agente.',403);
 if(!isAgent&&expense.agent_id===user.id)return fail('Impedida a aprovação de despesa própria após mudança de cargo para RH.',403);
 const from=String(expense.approval_status);
 let next=from;
 let updates:Change[]=[],details:Record<string,unknown>={},guard='';
 const now=new Date();
 const checkNote=(minimum=8)=>note.length>=minimum&&note.length<=500;
 if(isAgent){
  if(action==='resubmit'&&from==='returned'){
   const amount=amountValue(d.amount),desc=textValue(d.description,500),invoice=textValue(d.invoice_reference,100),recipient=normalCnpj(d.invoice_recipient_cnpj);
   if(amount===null||desc.length<6||invoice.length>100||recipient&&recipient.length!==14)return fail('Corrija valor, descrição e dados do comprovante.');
   next='submitted';
   updates=[['amount',amount],['description',desc],['invoice_reference',invoice||null],
    ['invoice_recipient_cnpj',recipient||null],['receipt_received_at',null],['receipt_received_by',null],
    ['physical_archive_reference',null],['accounting_contact',null],['accounting_reference',null],
    ['accounting_reviewed_at',null],['accounting_recorded_by',null],['approved_amount',null],['last_review_note',null]];
   details={previous_amount:Number(expense.amount),new_amount:amount};
  }else if(action==='acknowledge'&&from==='paid'){
   if(!expense.payment_reference||!expense.paid_at||expense.receipt_acknowledged_at||expense.receipt_disputed_at&&!expense.dispute_resolved_at)
    return fail('Este pagamento já foi confirmado ou possui contestação pendente.',409);
   updates=[['receipt_acknowledged_at',now]];guard='and receipt_acknowledged_at is null and payment_reference is not null and paid_at is not null and (receipt_disputed_at is null or dispute_resolved_at is not null)';
   details={confirmed_by_agent:true};
  }else if(action==='contest'&&from==='paid'){
   if(!expense.payment_reference||!expense.paid_at)return fail('Pagamento legado sem comprovante registrado. Informe o RH antes de contestar.',409);
   if(!checkNote(12))return fail('Explique a divergência em pelo menos 12 caracteres.');
   updates=[['receipt_disputed_at',now],['receipt_dispute_reason',note],
    ['dispute_resolved_at',null],['dispute_resolution_reference',null]];
   guard='and receipt_acknowledged_at is null and (receipt_disputed_at is null or dispute_resolved_at is not null)';
   details={reason:note};
  }else return fail('Esta operação não está disponível para o agente nesta etapa.',409);
 }else{
  if(action==='receive'&&from==='submitted'){
   const reference=textValue(d.invoice_reference,100),recipient=normalCnpj(d.invoice_recipient_cnpj);
   const issuer=normalCnpj(d.invoice_issuer_cnpj),accessKey=normalCnpj(d.invoice_access_key);
   const archive=textValue(d.archive_reference,200);
   const expected=normalCnpj(process.env.SINDPETSHOP_CNPJ||'');
   if(process.env.SINDPETSHOP_CNPJ&&expected.length!==14)return fail('SINDPETSHOP_CNPJ mal configurado: o valor deve ter 14 caracteres.',503);
   if(reference.length<3||reference.length>100||recipient.length!==14||issuer.length!==14||accessKey&&accessKey.length!==44||archive.length<3||archive.length>200||d.recipient_checked!==true)
    return fail('O RH deve conferir nota original, CNPJ destinatário e informar referência física de arquivamento.');
   if(expected.length===14&&recipient!==expected)return fail('CNPJ da nota diferente do CNPJ sindical configurado.',409);
   next='receipt_received';
   updates=[['invoice_reference',reference],['invoice_recipient_cnpj',recipient],
    ['invoice_issuer_cnpj',issuer],['invoice_access_key',accessKey||null],
    ['physical_archive_reference',archive],['receipt_received_at',now],['receipt_received_by',user.id],['last_review_note',null]];
   details={invoice_reference:reference,recipient_cnpj:recipient,issuer_cnpj:issuer,access_key:accessKey||null,archive_reference:archive,recipient_checked:true,automated_cnpj_match:expected.length===14};
  }else if(action==='send_accounting'&&from==='receipt_received'){
   next='accounting_review';
   details={forwarded_by_rh:true};
  }else if(action==='approve'&&from==='accounting_review'){
   const reviewer=textValue(d.accounting_contact,150),reference=textValue(d.accounting_reference,200);
   if(reviewer.length<3||reviewer.length>150||reference.length<3||reference.length>200||d.accounting_checked!==true)
    return fail('Informe responsável contábil, referência da aprovação externa e confirme a conferência.');
   next='approved';
   updates=[['accounting_contact',reviewer],['accounting_reference',reference],
    ['accounting_reviewed_at',now],['accounting_recorded_by',user.id],['approved_amount',Number(expense.amount)]];
   details={accounting_contact:reviewer,accounting_reference:reference,external_approval_recorded:true};
  }else if(action==='pay'&&from==='approved'){
   const paymentReference=textValue(d.payment_reference,200),method=textValue(d.payment_method,30);
   const paymentDate=d.payment_date,paid=amountValue(d.paid_amount);
   if(paymentReference.length<4||paymentReference.length>200||!paymentMethods.has(method)||!dateValid(paymentDate)||paid===null)
    return fail('Informe data, forma, valor e comprovante/identificador da transferência.');
   if(String(paymentDate)>todaySP())return fail('Não registre como realizado um pagamento futuro.');
   if(paid!==Number(expense.approved_amount))return fail('O valor transferido deve ser igual ao autorizado pela contabilidade.',409);
   if(d.payment_executed!==true)return fail('Confirme que o pagamento realmente ocorreu fora desta plataforma.');
   next='paid';
   updates=[['payment_reference',paymentReference],['payment_method',method],['paid_amount',paid],
    ['paid_at',now],['payment_date',paymentDate],['paid_by',user.id]];
   details={reference:paymentReference,method,amount:paid,date:paymentDate,reported_by_rh:true};
  }else if((action==='return'||action==='reject')&&['submitted','receipt_received','accounting_review'].includes(from)){
   if(!checkNote())return fail('Explique o motivo em pelo menos 8 caracteres.');
   next=action==='return'?'returned':'rejected';
   updates=[['last_review_note',note]];details={reason:note};
  }else if(action==='resolve_dispute'&&from==='paid'){
   const resolution=textValue(d.resolution_reference,200);
   if(!expense.receipt_disputed_at||expense.dispute_resolved_at||resolution.length<4||resolution.length>200||!checkNote())
    return fail('Informe a apuração da divergência e um protocolo/comprovante de resolução.');
   updates=[['dispute_resolved_at',now],['dispute_resolution_reference',resolution],['dispute_resolved_by',user.id]];
   guard='and receipt_disputed_at is not null and dispute_resolved_at is null and receipt_acknowledged_at is null';
   details={resolution_reference:resolution,details:note,requires_employee_acknowledgement:true};
  }else return fail('Esta transição não é permitida. Confira a situação e o histórico.',409);
 }
 const params:unknown[]=[id,user.id,from,next];
 const assignments=updates.map(([column,value])=>{
  // Apenas colunas definidas acima no servidor; valores sempre parametrizados.
  params.push(value);
  return column+'=$'+params.length;
 }).join(',');
 params.push(action,note||null,JSON.stringify(details));
 const act='$'+(params.length-2),noteParam='$'+(params.length-1),detailParam='$'+params.length;
 const sql=`with moved as (
  update expenses set approval_status=$4${assignments?','+assignments:''}
  where id=$1 and approval_status=$3 ${isAgent?'and agent_id=$2':''} ${guard}
  returning id
 ), tracked as (
  insert into expense_events(expense_id,actor_id,action,before_status,after_status,note,details)
  select id,$2,${act},$3,$4,${noteParam},${detailParam}::jsonb from moved returning id
 ), audited as (
  insert into audit_logs(actor_id,action,details)
  select $2,'expense.'||${act},jsonb_build_object('expense_id',id,'status',$4,'action',${act}) from moved returning id
 ) select moved.id from moved join tracked on true join audited on true`;
 let changed;
 try{changed=await db().query(sql,params)}
 catch(e){if((e as {code?:string})?.code==='23505')return fail('Já existe outro reembolso com esta chave fiscal. Confira possíveis duplicidades.',409);throw e}
 if(!changed.length)return fail('Esta despesa foi alterada por outra pessoa. Atualize a lista antes de continuar.',409);
 return NextResponse.json({ok:true,status:next,message:'Etapa registrada no histórico.'},protectedResponse);
}
