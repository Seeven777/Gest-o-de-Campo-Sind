'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Portal} from '@/components/portal';
import {Receipt,Wallet,Clock3,CheckCircle2,FileCheck2,History,ArrowRight,ChevronLeft,ChevronRight,AlertCircle,ShieldCheck} from 'lucide-react';
import './reembolsos.css';

type Role='admin'|'agent'|'rh';
type RouteOption={id:string;route_date:string;status:string;stops:number};
type Expense={id:string;route_id:string|null;agent_id:string;category:string;amount:number;expense_date:string;
 description:string|null;invoice_reference:string|null;invoice_recipient_cnpj:string|null;invoice_issuer_cnpj:string|null;invoice_access_key:string|null;
 approval_status:string;agent_name:string;campaign_name:string;created_at:string;
 receipt_received_at:string|null;physical_archive_reference:string|null;
 accounting_contact:string|null;accounting_reference:string|null;accounting_reviewed_at:string|null;approved_amount:number|null;
 payment_reference:string|null;payment_method:string|null;paid_amount:number|null;paid_at:string|null;payment_date:string|null;
 receipt_acknowledged_at:string|null;receipt_disputed_at:string|null;receipt_dispute_reason:string|null;
 dispute_resolved_at:string|null;dispute_resolution_reference:string|null;last_review_note:string|null};
type Event={id:number;action:string;before_status:string|null;after_status:string;note:string|null;created_at:string;actor_name:string;details:Record<string,unknown>};
type Summary={total:number;awaiting_paper:number;in_review:number;approved:number;awaiting_ack:number;legacy_paid:number;disputed:number;acknowledged:number};
const categories:Record<string,string>={fuel:'Combustível',food:'Alimentação',toll:'Pedágio',parking:'Estacionamento',lodging:'Hospedagem',other:'Outro gasto autorizado'};
const statuses:Record<string,string>={draft:'Rascunho',submitted:'Aguardando nota física',receipt_received:'Nota recebida pelo RH',accounting_review:'Em conferência contábil',approved:'Aprovado para pagamento',returned:'Correção solicitada',rejected:'Reprovado',paid:'Pagamento informado pelo RH'};
const eventNames:Record<string,string>={submitted:'Solicitação criada',receive:'Nota física recebida',send_accounting:'Enviado à contabilidade',approve:'Aprovação contábil registrada',return:'Devolvido para correção',reject:'Reprovado',pay:'Pagamento informado',acknowledge:'Recebimento confirmado pelo agente',contest:'Pagamento contestado',resolve_dispute:'Contestação respondida',resubmit:'Solicitação corrigida e reenviada'};
const actions:Record<string,string>={receive:'Registrar nota recebida',send_accounting:'Encaminhar à contabilidade',approve:'Registrar aprovação contábil',return:'Devolver para correção',reject:'Reprovar',pay:'Registrar pagamento efetuado',resolve_dispute:'Responder contestação',acknowledge:'Confirmar que recebi',contest:'Contestar pagamento',resubmit:'Reenviar solicitação'};
const fmt=(n:unknown)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=(v:string|null)=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const day=(v:string)=>v?.slice(0,10).split('-').reverse().join('/')||'—';
const today=()=>new Date().toLocaleDateString('sv-SE');

export default function Reembolsos(){
 const [role,setRole]=useState<Role|null>(null),[currentUserId,setCurrentUserId]=useState(''),[routes,setRoutes]=useState<RouteOption[]>([]);
 const requestKey=useRef<string|null>(null);
 const [rows,setRows]=useState<Expense[]>([]),[summary,setSummary]=useState<Summary>({total:0,awaiting_paper:0,in_review:0,approved:0,awaiting_ack:0,legacy_paid:0,disputed:0,acknowledged:0});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[statusFilter,setStatusFilter]=useState('');
 const [route,setRoute]=useState(''),[category,setCategory]=useState('fuel'),[amount,setAmount]=useState(''),[expenseDate,setExpenseDate]=useState(today);
 const [description,setDescription]=useState(''),[invoice,setInvoice]=useState(''),[recipient,setRecipient]=useState('');
 const [active,setActive]=useState<{id:string;action:string}|null>(null),[fields,setFields]=useState<Record<string,string>>({}),[checked,setChecked]=useState(false);
 const [historyId,setHistoryId]=useState<string|null>(null),[history,setHistory]=useState<Event[]>([]),[historyLoading,setHistoryLoading]=useState(false);
 const agent=role==='agent',rh=role==='rh',admin=role==='admin';
 async function load(nextPage=page,nextStatus=statusFilter){
  const res=await fetch('/api/despesas?'+new URLSearchParams({page:String(nextPage),status:nextStatus}),{cache:'no-store'});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível consultar reembolsos.');
  setRows(data.items||[]);setSummary(data.summary||{});setHasMore(Boolean(data.hasMore));
 }
 useEffect(()=>{
  let live=true;
  (async()=>{try{
   const me=await fetch('/api/me',{cache:'no-store'});const data=await me.json();
   if(!me.ok)throw Error(data.error||'Faça login novamente.');
   if(live){setRole(data.user.role);setCurrentUserId(String(data.user.id||''))}
   if(data.user.role==='agent'){
    const resp=await fetch('/api/rotas',{cache:'no-store'});const d=await resp.json();
    if(!resp.ok)throw Error(d.error||'Não foi possível consultar suas rotas.');
    if(live){
      const available=(d.items||[]).filter((x:RouteOption)=>['published','in_progress','completed'].includes(x.status)) as RouteOption[];
      setRoutes(available);
      const query=new URLSearchParams(window.location.search);
      const desired=query.get('rota')||'';
      if(available.some(x=>x.id===desired))setRoute(desired);
      const intended=query.get('categoria')||'';
      if(['fuel','food','toll','parking','lodging','other'].includes(intended))setCategory(intended);
     }
   }
  }catch(e){if(live)setError(e instanceof Error?e.message:'Falha ao identificar sua conta.')}})();
  return()=>{live=false};
 },[]);
 useEffect(()=>{
  let live=true;
  setLoading(true);
  fetch('/api/despesas?'+new URLSearchParams({page:String(page),status:statusFilter}),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao consultar despesas.');return d})
   .then(d=>{if(live){setRows(d.items||[]);setSummary(d.summary||{});setHasMore(Boolean(d.hasMore));setError('')}})
   .catch(e=>{if(live){setRows([]);setError(e instanceof Error?e.message:'Falha ao carregar despesas.')}})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[page,statusFilter]);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!requestKey.current)requestKey.current=crypto.randomUUID();
   const r=await fetch('/api/despesas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    route_id:route,request_id:requestKey.current,category,amount:Number(amount),expense_date:expenseDate,description,
    invoice_reference:invoice,invoice_recipient_cnpj:recipient})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível registrar.');
   setNotice(d.already_registered?'Esta solicitação já estava registrada. Nenhuma despesa duplicada foi criada.':'Solicitação registrada. Guarde a nota fiscal original e entregue-a ao RH quando retornar.');
   requestKey.current=null;
   setDescription('');setInvoice('');setRecipient('');setAmount('');setPage(1);setStatusFilter('');await load(1,'');
  }catch(e){setError(e instanceof Error?e.message:'Falha no registro.')}
  finally{setBusy(false)}
 }
 function openAction(x:Expense,action:string){
  setActive({id:x.id,action});setChecked(false);setError('');setNotice('');
  setFields({invoice_reference:x.invoice_reference||'',invoice_recipient_cnpj:x.invoice_recipient_cnpj||'',invoice_issuer_cnpj:x.invoice_issuer_cnpj||'',invoice_access_key:x.invoice_access_key||'',
   archive_reference:x.physical_archive_reference||'',paid_amount:String(x.approved_amount||x.amount),
   payment_date:today(),payment_method:'pix',payment_reference:'',accounting_contact:'',
   accounting_reference:'',note:'',resolution_reference:'',amount:String(x.amount),description:x.description||''});
 }
 async function perform(x:Expense,action:string){
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const body:Record<string,unknown>={id:x.id,action,...fields};
   if(action==='receive')body.recipient_checked=checked;
   if(action==='approve')body.accounting_checked=checked;
   if(action==='pay'){body.paid_amount=Number(fields.paid_amount);body.payment_executed=checked}
   if(action==='resubmit')body.amount=Number(fields.amount);
   const r=await fetch('/api/despesas',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível registrar a etapa.');
   setNotice((actions[action]||'Movimentação')+' — registro salvo com histórico.');
   setActive(null);setChecked(false);setHistoryId(null);await load();
  }catch(e){setError(e instanceof Error?e.message:'Falha na operação.')}
  finally{setBusy(false)}
 }
 async function showHistory(id:string){
  if(historyId===id){setHistoryId(null);return}
  setHistoryId(id);setHistory([]);setHistoryLoading(true);setError('');
  try{const r=await fetch('/api/despesas/'+id+'/historico',{cache:'no-store'});const d=await r.json();
   if(!r.ok)throw Error(d.error||'Não foi possível consultar o histórico.');setHistory(d.items||[]);
  }catch(e){setError(e instanceof Error?e.message:'Histórico indisponível.')}
  finally{setHistoryLoading(false)}
 }
 const canAct=(x:Expense):string[]=>{
  if(agent){
   if(x.approval_status==='returned')return ['resubmit'];
   if(x.approval_status==='paid'&&x.payment_reference&&x.paid_at&&!x.receipt_acknowledged_at&&(!x.receipt_disputed_at||x.dispute_resolved_at))return ['acknowledge','contest'];
   return [];
  }
  if(!rh||x.agent_id===currentUserId)return [];
  if(x.approval_status==='submitted')return ['receive','return','reject'];
  if(x.approval_status==='receipt_received')return ['send_accounting','return','reject'];
  if(x.approval_status==='accounting_review')return ['approve','return','reject'];
  if(x.approval_status==='approved')return ['pay'];
  if(x.approval_status==='paid'&&x.receipt_disputed_at&&!x.dispute_resolved_at)return ['resolve_dispute'];
  return [];
 };
 const field=(key:string,label:string,placeholder='',type='text')=><label className="expense-field" key={key}>{label}
  <input className="field" type={type} maxLength={type==='text'?200:undefined} placeholder={placeholder}
   value={fields[key]||''} onChange={e=>setFields(previous=>({...previous,[key]:e.target.value}))}/></label>;
 const actionForm=(x:Expense,action:string)=>{
  const needChecks=['receive','approve','pay'].includes(action);
  return <div className="expense-action-form">
   <strong>{actions[action]}</strong>
   {action==='receive'&&<>
    {field('invoice_reference','Número ou referência da nota fiscal','Referência da nota')}
    {field('invoice_recipient_cnpj','CNPJ do sindicato destinatário (14 caracteres)','CNPJ impresso na nota')}
    {field('invoice_issuer_cnpj','CNPJ do fornecedor emissor (14 caracteres)','CNPJ do estabelecimento que emitiu a nota')}
    {field('invoice_access_key','Chave de acesso fiscal (se houver, 44 caracteres)','Quando constar na NF-e ou NFC-e')}
    {field('archive_reference','Local/protocolo da nota física','Ex.: Pasta RH novembro/2026, nº 25')}
   </>}
   {action==='approve'&&<>
    {field('accounting_contact','Responsável que conferiu na contabilidade','Nome do profissional ou escritório')}
    {field('accounting_reference','Referência da aprovação contábil','Número do processo, e-mail ou protocolo')}
   </>}
   {action==='pay'&&<>
    {field('paid_amount','Valor efetivamente pago (R$)','', 'number')}
    <label className="expense-field">Data do pagamento<input className="field" type="date" value={fields.payment_date||today()} onChange={e=>setFields(p=>({...p,payment_date:e.target.value}))}/></label>
    <label className="expense-field">Forma de pagamento<select className="field" value={fields.payment_method||'pix'} onChange={e=>setFields(p=>({...p,payment_method:e.target.value}))}>
     <option value="pix">PIX</option><option value="transfer">Transferência bancária</option><option value="payroll">Folha de pagamento</option><option value="cash">Dinheiro, com recibo</option><option value="other">Outra</option>
    </select></label>
    {field('payment_reference','Identificador do pagamento realizado','Identificador, comprovante ou lançamento contábil')}
    <p className="expense-hint">Esta ação registra uma operação financeira já executada. O aplicativo não transfere valores.</p>
   </>}
   {action==='resubmit'&&<>
    {field('amount','Valor corrigido (R$)','','number')}
    {field('description','Descrição da despesa corrigida')}
    {field('invoice_reference','Referência da nota')}
    {field('invoice_recipient_cnpj','CNPJ destinatário, se disponível')}
    {x.last_review_note&&<p className="expense-warning">Motivo devolução: {x.last_review_note}</p>}
   </>}
   {['return','reject','contest','resolve_dispute'].includes(action)&&<label className="expense-field">
    {action==='contest'?'Explique a divergência':action==='resolve_dispute'?'Como foi resolvida a divergência':'Motivo obrigatório'}
    <textarea className="field" rows={3} maxLength={500} value={fields.note||''} onChange={e=>setFields(p=>({...p,note:e.target.value}))}/>
   </label>}
   {action==='resolve_dispute'&&field('resolution_reference','Referência da solução (comprovante ou protocolo)')}
   {needChecks&&<label className="expense-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>
    <span>{action==='receive'?'Recebi a nota fiscal física, conferi emitente, destinatário, CNPJ sindical e valor correspondente à solicitação.':action==='approve'?'Recebi a conferência e aprovação da contabilidade, identificadas acima.':'Confirmo que o pagamento indicado já foi executado e possui comprovação externa.'}</span></label>}
   <div className="expense-form-actions">
    <button type="button" className="expense-secondary" disabled={busy} onClick={()=>setActive(null)}>Cancelar</button>
    <button type="button" className="expense-primary" disabled={busy||needChecks&&!checked} onClick={()=>void perform(x,action)}>
     {busy?'Registrando...':actions[action]}<ArrowRight size={16}/></button>
   </div>
  </div>;
 };
 return <Portal title={rh?'Central de reembolsos':agent?'Meus reembolsos':'Reembolsos e histórico'} subtitle={rh?'Conferência da nota fiscal, contabilidade e controle de pagamentos.':agent?'Solicite na rota e acompanhe cada etapa, até confirmar seu recebimento.':'Visão administrativa dos comprovantes, aprovações e pagamentos.'}>
  <div className="expense-workspace">
   <div className="expense-stats">
    <div><span><Receipt size={16}/> Solicitações</span><strong>{summary.total}</strong></div>
    <div><span><Clock3 size={16}/> Nota/ajuste pendente</span><strong>{summary.awaiting_paper}</strong></div>
    <div><span><FileCheck2 size={16}/> Em conferência</span><strong>{summary.in_review}</strong></div>
    <div><span><Wallet size={16}/> Aguardando confirmação</span><strong>{summary.awaiting_ack}</strong></div>
   </div>
   {agent&&<section className="panel expense-panel">
    <div className="expense-heading"><div><small>DESPESA EM ROTA</small><h2>Nova solicitação</h2></div><Receipt size={24}/></div>
    <div className="expense-guidance"><ShieldCheck size={22}/><p>Solicite ao estabelecimento a nota fiscal com o <strong>CNPJ do SindPetshop-SP</strong> como destinatário, conforme orientação do RH. Registre o gasto agora e entregue a nota original ao RH ao retornar. O fornecedor emite a nota fiscal; este aplicativo não a emite.</p></div>
    <form className="expense-form-grid" onSubmit={submit}>
     <label className="expense-field">Rota<select className="field" value={route} required onChange={e=>setRoute(e.target.value)}>
      <option value="">Selecione a rota da despesa</option>{routes.map(r=><option key={r.id} value={r.id}>Rota {day(r.route_date)} · {r.stops} empresas</option>)}
     </select></label>
     <label className="expense-field">Categoria<select className="field" value={category} onChange={e=>setCategory(e.target.value)}>
      {Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select></label>
     <label className="expense-field">Valor pago (R$)<input type="number" className="field" min=".01" max="50000" step=".01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
     <label className="expense-field">Data da despesa<input type="date" className="field" required value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></label>
     <label className="expense-field expense-wide">Descrição do gasto<input className="field" required minLength={6} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Abastecimento para rota em Guarulhos"/></label>
     <label className="expense-field">Referência da nota (se disponível)<input className="field" maxLength={100} value={invoice} onChange={e=>setInvoice(e.target.value)} placeholder="Número da nota fiscal"/></label>
     <label className="expense-field">CNPJ destinatário da nota (se disponível)<input className="field" maxLength={20} autoCapitalize="characters" value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="14 caracteres"/></label>
     <button className="expense-primary expense-wide" type="submit" disabled={busy||!routes.length}>Registrar solicitação<ArrowRight size={18}/></button>
    </form>
    {!routes.length&&<p className="expense-hint">Nenhuma rota atribuída está disponível. Solicite a publicação de uma rota à administração.</p>}
   </section>}
   {rh&&summary.legacy_paid>0&&<p className="expense-warning" role="status"><AlertCircle size={18}/> Existem {summary.legacy_paid} pagamentos antigos sem referência bancária registrada. Devem ser conciliados com o RH e a contabilidade antes de qualquer confirmação de recebimento.</p>}
   {rh&&<p className="expense-guidance"><FileCheck2 size={21}/><span>O RH registra o recebimento físico e documenta a conferência externa da contabilidade. <strong>Não marque como pago antes da transferência ocorrer.</strong> O colaborador ainda poderá confirmar ou contestar o recebimento.</span></p>}
   {admin&&<p className="expense-guidance"><ShieldCheck size={20}/><span>Consulta administrativa: as mudanças de estado são exclusivas do RH e do titular da despesa. Aprovações contábeis e transferências são conferidas fora desta plataforma.</span></p>}
   {error&&<p className="error" role="alert">{error}</p>}
   {notice&&<p className="success" role="status">{notice}</p>}
   <section className="panel expense-panel">
    <div className="expense-heading"><div><small>ACOMPANHAMENTO</small><h2>{rh?'Fila de RH e pagamentos':agent?'Minhas solicitações':'Histórico de despesas'}</h2></div><History size={23}/></div>
    <div className="expense-filters"><label>Situação<select className="field" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);setActive(null)}}>
     <option value="">Todas</option>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label></div>
    <div className="expense-list">{rows.map(x=><article className="expense-item" key={x.id}>
     <div className="expense-row-main"><span className="expense-category-icon"><Receipt size={22}/></span>
      <div className="expense-main-info"><strong>{categories[x.category]||x.category} · {fmt(x.amount)}</strong>
       <small>{agent?'Minha solicitação':x.agent_name} · {day(x.expense_date)} · {x.campaign_name}</small>
       <span>{x.description||'Sem descrição'}</span>
      </div>
      <div className="expense-state"><span className={'expense-badge expense-'+x.approval_status}>{x.receipt_acknowledged_at?'Recebimento confirmado':x.receipt_disputed_at&&!x.dispute_resolved_at?'Pagamento contestado':x.approval_status==='paid'&&!x.payment_reference?'Pagamento antigo sem comprovação':statuses[x.approval_status]||x.approval_status}</span>
       <button type="button" className="expense-history-link" onClick={()=>void showHistory(x.id)}><History size={15}/>{historyId===x.id?'Fechar histórico':'Ver histórico'}</button></div>
     </div>
     {x.last_review_note&&['returned','rejected'].includes(x.approval_status)&&<p className="expense-warning"><AlertCircle size={16}/> {x.last_review_note}</p>}
     {(x.receipt_received_at||x.accounting_reference||x.payment_reference)&&<details className="expense-record-details">
      <summary>Ver comprovantes e referências</summary>
      {x.receipt_received_at&&<p className="expense-inline-proof"><CheckCircle2 size={15}/> Nota recebida pelo RH: {date(x.receipt_received_at)} · Arquivo: {x.physical_archive_reference||'—'}</p>}
      {x.accounting_reference&&<p className="expense-inline-proof">Conferência contábil: {x.accounting_contact} · {x.accounting_reference}</p>}
      {x.payment_reference&&<p className="expense-inline-proof"><Wallet size={15}/> {x.receipt_acknowledged_at?'Recebido pelo agente':'Pagamento informado'}: {fmt(x.paid_amount)} · {day(x.payment_date||'')} · Ref. {x.payment_reference}</p>}
     </details>}
     {rh&&x.approval_status==='paid'&&x.receipt_disputed_at&&!x.dispute_resolved_at&&<p className="expense-warning"><AlertCircle size={16}/> Agente contestou: {x.receipt_dispute_reason||'Verifique o histórico.'}</p>}
     {canAct(x).length>0&&<div className="expense-available-actions">{canAct(x).map(action=><button type="button" key={action} disabled={busy} className="expense-secondary" onClick={()=>openAction(x,action)}>{actions[action]}</button>)}</div>}
     {active?.id===x.id&&actionForm(x,active.action)}
     {historyId===x.id&&<div className="expense-timeline"><h3>Histórico auditável</h3>
      {historyLoading&&<p>Carregando histórico...</p>}
      {history.map(event=><div className="expense-timeline-event" key={event.id}><span className="expense-timeline-dot"/><div>
       <strong>{eventNames[event.action]||event.action}</strong><small>{event.actor_name} · {date(event.created_at)}</small>
       {event.note&&<p>{event.note}</p>}</div></div>)}
      {!history.length&&!historyLoading&&<p className="expense-hint">Não há eventos disponíveis para esta despesa. Registros anteriores à migração podem não ter trilha detalhada.</p>}
     </div>}
    </article>)}
    {!rows.length&&<div className="expense-empty"><Receipt size={30}/><strong>{loading?'Carregando...':'Nenhuma solicitação neste filtro'}</strong>
     <p>{agent?'Suas despesas registradas aparecerão aqui.':'Assim que os agentes registrarem despesas, a fila aparecerá aqui.'}</p></div>}
    </div>
    <div className="expense-pages"><button type="button" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/> Anterior</button><span>Página {page}</span><button type="button" disabled={!hasMore||loading} onClick={()=>setPage(p=>p+1)}>Próxima <ChevronRight size={18}/></button></div>
   </section>
  </div>
 </Portal>;
}
