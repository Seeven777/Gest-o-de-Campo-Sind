'use client';

import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Portal} from '@/components/portal';
import {
 ArrowRight,Building2,Check,CheckCircle2,ChevronLeft,ChevronRight,ClipboardCheck,
 Clock3,Copy,FileCheck2,Info,RefreshCw,Search,ShieldCheck,X
} from 'lucide-react';
import './cadastros.css';

type Role='admin'|'supervisor'|'cadastro'|'agent'|'rh';
type View='pending'|'confirmed';
type Company={
 id:string;cnpj:string;legal_name:string;trade_name:string|null;
 city:string|null;state:string|null;field_status:string;
 validated_at:string|null;registration_state:string;
 reference:string|null;confirmed_at:string|null;
 official_verified_at:string|null;confirmed_by_name:string|null;
};
type Totals={pending:number;confirmed:number};
type ListResponse={items:Company[];totals:Totals;hasMore:boolean;error?:string};
const formatDate=(value:string|null)=>value
 ?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const formatCnpj=(value:string)=>String(value||'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');
const companyName=(item:Company)=>item.trade_name||item.legal_name;

export default function Cadastros(){
 const [role,setRole]=useState<Role|null>(null),[view,setView]=useState<View>('confirmed');
 const [term,setTerm]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [items,setItems]=useState<Company[]>([]),[totals,setTotals]=useState<Totals>({pending:0,confirmed:0});
 const [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [notice,setNotice]=useState(''),[openId,setOpenId]=useState('');
 const [reference,setReference]=useState(''),[checked,setChecked]=useState(false),[saving,setSaving]=useState(false);
 const [copied,setCopied]=useState('');
 const inputRef=useRef<HTMLInputElement|null>(null);
 const canConfirm=role==='admin'||role==='cadastro';
 const roleReady=role!==null;
 const resetReview=useCallback(()=>{setOpenId('');setReference('');setChecked(false)},[]);

 useEffect(()=>{
  let alive=true;
  fetch('/api/me',{cache:'no-store'}).then(async r=>{
   const d=await r.json();if(!r.ok)throw Error(d.error||'Sua sessão não está disponível.');
   return d;
  }).then(d=>{
   if(!alive)return;
   const next=d.user.role as Role;
   setRole(next);setView(next==='admin'||next==='cadastro'?'pending':'confirmed');
  }).catch(e=>{if(alive){setError(e instanceof Error?e.message:'Não foi possível verificar seu perfil.');setLoading(false)}});
  return()=>{alive=false};
 },[]);

 useEffect(()=>{
  if(!roleReady)return;
  let alive=true;
  const controller=new AbortController();
  setLoading(true);setError('');
  fetch('/api/cadastros?'+new URLSearchParams({view,q:query,page:String(page)}),
   {cache:'no-store',signal:controller.signal})
   .then(async r=>{
    const d=await r.json() as ListResponse;
    if(!r.ok)throw Error(d.error||'Não foi possível consultar os cadastros.');
    return d;
   }).then(d=>{
    if(!alive)return;
    setItems(d.items||[]);setHasMore(Boolean(d.hasMore));
    setTotals(d.totals||{pending:0,confirmed:0});
   }).catch(e=>{
    if(!alive||controller.signal.aborted)return;
    setItems([]);setHasMore(false);
    setError(e instanceof Error?e.message:'Falha ao consultar os registros.');
   }).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false;controller.abort()};
 },[roleReady,view,query,page,revision]);

 useEffect(()=>{
  if(!openId)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!saving)resetReview()};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[openId,saving,resetReview]);

 const selectView=(next:View)=>{
  if(saving||next===view)return;
  setView(next);setPage(1);resetReview();setNotice('');setError('');
 };
 const open=(id:string)=>{
  if(saving)return;
  if(openId===id){resetReview();return}
  resetReview();setOpenId(id);setNotice('');setError('');
  window.requestAnimationFrame(()=>inputRef.current?.focus());
 };
 const search=(e:FormEvent)=>{e.preventDefault();resetReview();setPage(1);setQuery(term.trim())};
 const clearSearch=()=>{setTerm('');setQuery('');setPage(1);resetReview()};
 const copyCnpj=async(item:Company)=>{
  try{
   await navigator.clipboard.writeText(item.cnpj.replace(/\D/g,''));
   setCopied(item.id);
  }catch{setError('Não foi possível copiar o CNPJ neste dispositivo. Selecione o número manualmente.')}
 };
 async function confirm(item:Company){
  if(!canConfirm||!checked||reference.trim().length<3||saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/cadastros',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     establishment_id:item.id,state:'confirmed',
     reference:reference.trim(),officially_checked:true,
    }),
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Não foi possível registrar a confirmação.');
   setNotice('Confirmação de '+companyName(item)+' registrada com sucesso. O histórico foi atualizado.');
   resetReview();setRevision(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar a confirmação.')}
  finally{setSaving(false)}
 }
 const title=view==='pending'?'Aguardando cadastro':'Cadastros sindicais confirmados';
 return <Portal title="Área de Cadastro" subtitle="Conferência de empresas validadas e registro de confirmação na base sindical.">
  <div className="registration-workspace">
   <header className="registration-hero">
    <div className="registration-hero-copy">
     <span className="registration-eyebrow"><ShieldCheck size={15}/> OPERAÇÃO DE CADASTRO</span>
     <h2>Da visita à confirmação.</h2>
     <p>Receba empresas validadas pela supervisão, consulte a base oficial do sindicato e registre a confirmação com segurança.</p>
    </div>
    <div className="registration-hero-icon" aria-hidden="true"><FileCheck2 size={37} strokeWidth={1.7}/></div>
   </header>

   <div className="registration-summary" aria-label="Resumo do trabalho de cadastro">
    <button type="button" disabled={!canConfirm} aria-pressed={view==='pending'}
     className={'registration-stat'+(view==='pending'?' active':'')} onClick={()=>selectView('pending')}>
     <span className="registration-stat-heading"><Clock3 size={18}/> Na fila</span>
     <strong>{roleReady?fmt(totals.pending):'—'}</strong>
     <small>Empresas validadas aguardando confirmação</small>
     {canConfirm&&<span className="registration-stat-link">Conferir empresas <ArrowRight size={15}/></span>}
    </button>
    <button type="button" aria-pressed={view==='confirmed'}
     className={'registration-stat'+(view==='confirmed'?' active':'')} onClick={()=>selectView('confirmed')}>
     <span className="registration-stat-heading"><CheckCircle2 size={18}/> Confirmados</span>
     <strong>{roleReady?fmt(totals.confirmed):'—'}</strong>
     <small>Confirmados após verificação na base oficial</small>
     <span className="registration-stat-link">Consultar histórico <ArrowRight size={15}/></span>
    </button>
   </div>

   <section className="registration-panel" aria-labelledby="registration-heading">
    <div className="registration-heading">
     <div>
      <span className="registration-eyebrow">ÁREA DE TRABALHO</span>
      <h2 id="registration-heading">{title}</h2>
      <p>{view==='pending'
       ?'Somente empresas validadas em campo, ainda sem confirmação oficial.'
       :'Somente empresas com confirmação registrada após conferência na base do sindicato.'}</p>
     </div>
     <button type="button" className="registration-refresh" disabled={loading}
      onClick={()=>{resetReview();setRevision(v=>v+1)}} title="Atualizar lista">
      <RefreshCw size={18} aria-hidden="true"/> <span>Atualizar</span>
     </button>
    </div>

    <nav className="registration-tabs" aria-label="Etapas do cadastro">
     {canConfirm&&<button type="button" aria-current={view==='pending'?'page':undefined}
      className={view==='pending'?'active':''} onClick={()=>selectView('pending')}>
      <ClipboardCheck size={18}/> A conferir <span>{fmt(totals.pending)}</span></button>}
     <button type="button" aria-current={view==='confirmed'?'page':undefined}
      className={view==='confirmed'?'active':''} onClick={()=>selectView('confirmed')}>
      <ShieldCheck size={18}/> Cadastros confirmados <span>{fmt(totals.confirmed)}</span></button>
    </nav>

    {view==='pending'&&canConfirm&&<div className="registration-instruction" role="note">
     <Info size={20} aria-hidden="true"/>
     <p><strong>A conferência acontece no sistema oficial.</strong> Esta ferramenta ainda não cadastra empresas automaticamente na base do SindPetshop-SP. Primeiro cadastre ou localize a empresa no sistema oficial; depois registre aqui o identificador e a confirmação.</p>
    </div>}

    <form className="registration-search" role="search" onSubmit={search}>
     <Search size={20} aria-hidden="true"/>
     <input aria-label="Buscar empresa por nome, CNPJ ou município" value={term} maxLength={100}
      onChange={e=>setTerm(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade..."/>
     {term&&<button type="button" className="registration-clear" title="Limpar busca" aria-label="Limpar busca" onClick={clearSearch}><X size={18}/></button>}
     <button type="submit" className="registration-search-button">Buscar</button>
    </form>

    {notice&&<div className="registration-message registration-message-success" role="status">
     <CheckCircle2 size={19} aria-hidden="true"/><span>{notice}</span>
     <button type="button" onClick={()=>selectView('confirmed')}>Ver confirmados <ArrowRight size={15}/></button>
    </div>}
    {error&&<div className="registration-message registration-message-error" role="alert">
     <Info size={19} aria-hidden="true"/><span>{error}</span>
     <button type="button" onClick={()=>setRevision(n=>n+1)}>Tentar novamente</button>
    </div>}

    <div className="registration-list" aria-busy={loading}>
     {loading&&<div className="registration-skeleton" role="status" aria-label="Carregando empresas">
      {Array.from({length:3},(_,i)=><div key={i}><span/><div><i/><i/></div></div>)}
     </div>}
     {!loading&&items.map(item=><article className={'registration-item'+(openId===item.id?' expanded':'')} key={item.id}>
      <div className="registration-row">
       <div className="registration-company">
        <span className="registration-avatar" aria-hidden="true"><Building2 size={22}/></span>
        <div>
         <strong>{companyName(item)}</strong>
         {item.trade_name&&item.legal_name!==item.trade_name&&<small>{item.legal_name}</small>}
         <div className="registration-company-meta">
          <span className="registration-cnpj">{formatCnpj(item.cnpj)}</span>
          <button type="button" className="registration-copy" title="Copiar CNPJ"
           aria-label={'Copiar CNPJ de '+companyName(item)} onClick={()=>void copyCnpj(item)}>
           {copied===item.id?<Check size={16}/>:<Copy size={16}/>}
           <span>{copied===item.id?'Copiado':'Copiar'}</span>
          </button>
          <span className="registration-meta-divider" aria-hidden="true">·</span>
          <span>{[item.city,item.state].filter(Boolean).join(' / ')||'Cidade não informada'}</span>
         </div>
        </div>
       </div>
       {view==='pending'?<div className="registration-item-actions">
        <span className="registration-pill waiting"><Clock3 size={15}/> A conferir</span>
        {canConfirm&&<button type="button" className="registration-open"
         aria-expanded={openId===item.id} aria-controls={'review-'+item.id}
         onClick={()=>open(item.id)}>
         {openId===item.id?'Fechar conferência':'Conferir empresa'} <ArrowRight size={17}/>
        </button>}
       </div>:<div className="registration-proof">
        <span className="registration-pill confirmed"><CheckCircle2 size={15}/> Confirmado</span>
        <div className="registration-proof-reference"><span>Referência oficial</span><strong>{item.reference||'—'}</strong></div>
        <small>{item.confirmed_by_name?'Por '+item.confirmed_by_name+' · ':''}{formatDate(item.official_verified_at||item.confirmed_at)}</small>
       </div>}
      </div>
      {canConfirm&&view==='pending'&&openId===item.id&&<form id={'review-'+item.id}
       className="registration-confirm-form" onSubmit={e=>{e.preventDefault();void confirm(item)}}>
       <div className="registration-review-heading">
        <span className="registration-review-icon"><FileCheck2 size={23}/></span>
        <div>
         <strong>Conferência do cadastro sindical</strong>
         <p>Confirme esta empresa na base oficial antes de concluir.</p>
        </div>
       </div>
       {item.registration_state==='confirmed'&&!item.official_verified_at&&
        <div className="registration-legacy-warning" role="note">
         <Info size={17}/>
         <span>Existe uma confirmação antiga sem verificação oficial. Ela não é considerada cadastro confirmado até uma nova conferência.</span>
        </div>}
       <div className="registration-review-steps" aria-label="Etapas de confirmação">
        <span><b>1</b> Pesquise o CNPJ na base oficial.</span>
        <span><b>2</b> Conclua ou verifique o cadastro.</span>
        <span><b>3</b> Informe o protocolo e confirme.</span>
       </div>
       <label className="registration-reference-label" htmlFor={'reference-'+item.id}>Número ou referência no sistema oficial <span>*</span></label>
       <input ref={inputRef} id={'reference-'+item.id} className="registration-reference" autoComplete="off"
        maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}
        placeholder="Ex.: protocolo ou código da empresa"/>
       <label className="registration-check">
        <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>
        <span>Verifiquei o CNPJ <b>{formatCnpj(item.cnpj)}</b> no sistema oficial e confirmo que o cadastro desta empresa foi realizado.</span>
       </label>
       <div className="registration-confirm-actions">
        <button type="button" className="registration-cancel" disabled={saving} onClick={resetReview}>Cancelar</button>
        <button type="submit" className="registration-confirm" disabled={saving||!checked||reference.trim().length<3}>
         {saving?<RefreshCw size={18} className="registration-spinner"/>:<CheckCircle2 size={18}/>}
         {saving?'Registrando confirmação...':'Confirmar cadastro'} <ArrowRight size={17}/>
        </button>
       </div>
       <p className="registration-confirm-caption">A confirmação registra data, usuário e protocolo para auditoria. Não altera a base oficial externa.</p>
      </form>}
     </article>)}
     {!loading&&!items.length&&!error&&<div className="registration-empty" role="status">
      <span><CheckCircle2 size={31} aria-hidden="true"/></span>
      <strong>{query?'Nenhum resultado para sua busca':view==='pending'?'Nenhuma empresa aguardando conferência':'Nenhum cadastro confirmado ainda'}</strong>
      <p>{query?'Limpe a pesquisa ou tente outro nome, município ou CNPJ.'
       :view==='pending'?'Quando a supervisão validar novas empresas em campo, elas aparecerão nesta fila.'
       :'Após conferir e confirmar os registros na base sindical, o histórico será apresentado aqui.'}</p>
      {query&&<button type="button" onClick={clearSearch}>Limpar pesquisa</button>}
     </div>}
    </div>
    {(page>1||hasMore)&&<nav className="registration-pagination" aria-label="Paginação de empresas">
     <button type="button" disabled={page===1||loading} onClick={()=>{setPage(n=>Math.max(1,n-1));resetReview()}}><ChevronLeft size={18}/> Anterior</button>
     <span>Página {page}</span>
     <button type="button" disabled={!hasMore||loading} onClick={()=>{setPage(n=>n+1);resetReview()}}>Próxima <ChevronRight size={18}/></button>
    </nav>}
   </section>
  </div>
 </Portal>;
}
