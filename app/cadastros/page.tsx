'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {Portal} from '@/components/portal';
import {CheckCircle2,ClipboardCheck,Search,ShieldCheck,Building2,ArrowRight,Clock3,ExternalLink,ChevronLeft,ChevronRight} from 'lucide-react';
import './cadastros.css';

type UserRole='admin'|'supervisor'|'cadastro'|'agent';
type View='pending'|'confirmed';
type Company={id:string;cnpj:string;legal_name:string;trade_name:string|null;city:string|null;state:string|null;
 registration_state:string;reference:string|null;confirmed_at:string|null;confirmed_by_name:string|null};
type Totals={pending:number;confirmed:number};
const date=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const cnpj=(value:string)=>value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');

export default function Cadastros(){
 const [role,setRole]=useState<UserRole|null>(null),[view,setView]=useState<View>('confirmed');
 const [term,setTerm]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [items,setItems]=useState<Company[]>([]),[totals,setTotals]=useState<Totals>({pending:0,confirmed:0});
 const [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [openId,setOpenId]=useState(''),[reference,setReference]=useState(''),[checked,setChecked]=useState(false),[saving,setSaving]=useState(false);
 const canConfirm=role==='admin'||role==='cadastro';
 useEffect(()=>{let alive=true;
  fetch('/api/me',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Sessão indisponível');return d;})
   .then(d=>{if(!alive)return;const next=d.user.role as UserRole;setRole(next);if(next==='admin'||next==='cadastro')setView('pending')})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:'Não foi possível confirmar seu perfil.')});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  let alive=true;setLoading(true);setError('');
  fetch('/api/cadastros?'+new URLSearchParams({view,q:query,page:String(page)}),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao consultar cadastros.');return d;})
   .then(d=>{if(alive){setItems(d.items||[]);setHasMore(Boolean(d.hasMore));setTotals(d.totals||{pending:0,confirmed:0});}})
   .catch(e=>{if(alive){setItems([]);setHasMore(false);setError(e instanceof Error?e.message:'Falha ao consultar cadastros.')}})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[view,query,page,revision]);
 const selectView=(next:View)=>{setView(next);setPage(1);setOpenId('');setReference('');setChecked(false);setNotice('');setError('')};
 const open=(id:string)=>{setOpenId(id);setReference('');setChecked(false);setError('')};
 async function confirm(company:Company){
  if(!checked||reference.trim().length<3||saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/cadastros',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({establishment_id:company.id,state:'confirmed',reference:reference.trim(),officially_checked:true})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível confirmar.');
   setNotice('Cadastro de '+(company.trade_name||company.legal_name)+' confirmado na base sindical.');
   setOpenId('');setChecked(false);setReference('');setRevision(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao confirmar cadastro.')}
  finally{setSaving(false)}
 }
 const title=view==='pending'?'Aguardando conferência':'Cadastros confirmados';
 return <Portal title="Cadastros sindicais" subtitle="Da validação em campo à confirmação na base oficial do SindPetshop-SP.">
  <div className="registration-workspace">
   <div className="registration-summary" aria-label="Situação dos cadastros">
    <div><span><Clock3 size={17}/> Aguardando conferência</span><strong>{totals.pending.toLocaleString('pt-BR')}</strong><small>Validadas em campo; ainda sem confirmação sindical</small></div>
    <div><span><CheckCircle2 size={17}/> Cadastros confirmados</span><strong>{totals.confirmed.toLocaleString('pt-BR')}</strong><small>Registrados e conferidos na base oficial</small></div>
   </div>
   <section className="panel registration-panel">
    <div className="registration-heading">
     <div><span className="registration-eyebrow">CONFERÊNCIA SINDICAL</span><h2>{title}</h2>
      <p>A validação em campo é feita pela supervisão. O cadastro só será confirmado aqui após consultar o sistema oficial do sindicato.</p></div>
     <ShieldCheck size={29} aria-hidden="true"/>
    </div>
    <div className="registration-tabs" role="group" aria-label="Filtrar etapa do cadastro">
     {canConfirm&&<button type="button" aria-pressed={view==='pending'} className={view==='pending'?'active':''} onClick={()=>selectView('pending')}><ClipboardCheck size={17}/> A conferir</button>}
     <button type="button" aria-pressed={view==='confirmed'} className={view==='confirmed'?'active':''} onClick={()=>selectView('confirmed')}><CheckCircle2 size={17}/> Confirmados</button>
    </div>
    {view==='pending'&&canConfirm&&<div className="registration-instruction" role="note">
     <span><ExternalLink size={20}/></span>
     <p><strong>Etapa externa:</strong> localize a empresa no sistema oficial do SindPetshop-SP e verifique se o cadastro foi realmente concluído. Só depois informe o número ou referência correspondente e confirme abaixo. Este aplicativo ainda não consulta a base oficial automaticamente.</p>
    </div>}
    <form className="registration-search" onSubmit={(e:FormEvent)=>{e.preventDefault();setPage(1);setQuery(term)}}>
     <Search size={18} aria-hidden="true"/><input aria-label="Buscar empresa, CNPJ ou município" value={term}
      onChange={e=>setTerm(e.target.value)} placeholder="Empresa, CNPJ ou município"/>
     <button type="submit">Buscar</button>
    </form>
    {notice&&<p className="success" role="status">{notice}</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="registration-list">
     {items.map(company=><article className="registration-item" key={company.id}>
      <div className="registration-company">
       <span className="registration-avatar"><Building2 size={21}/></span>
       <div><strong>{company.trade_name||company.legal_name}</strong>
        {company.trade_name&&company.trade_name!==company.legal_name&&<small>{company.legal_name}</small>}
        <span>{cnpj(company.cnpj)} · {[company.city,company.state].filter(Boolean).join(' / ')||'Localização não informada'}</span>
       </div>
      </div>
      {view==='confirmed'?<div className="registration-proof">
       <span className="registration-pill confirmed"><CheckCircle2 size={15}/> Confirmado</span>
       <p><b>Referência oficial:</b> {company.reference||'Sem referência'}</p>
       <small>{company.confirmed_by_name?'Por '+company.confirmed_by_name+' · ':''}{date(company.confirmed_at)}</small>
      </div>:<div className="registration-item-actions">
       <span className="registration-pill waiting"><Clock3 size={15}/> Pendente de cadastro</span>
       {canConfirm&&<button type="button" className="registration-open" aria-expanded={openId===company.id} onClick={()=>openId===company.id?setOpenId(''):open(company.id)}>
        {openId===company.id?'Cancelar':'Conferir cadastro'}<ArrowRight size={17}/></button>}
      </div>}
      {canConfirm&&view==='pending'&&openId===company.id&&<div className="registration-confirm-form">
       <label htmlFor={'reference-'+company.id}>Referência do cadastro no sistema oficial <span>*</span></label>
       <input id={'reference-'+company.id} className="field" maxLength={200} value={reference}
        onChange={e=>setReference(e.target.value)} placeholder="Número, protocolo ou identificador do cadastro" autoComplete="off"/>
       <label className="registration-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>
        <span>Conferi esta empresa no sistema oficial do SindPetshop-SP e confirmo que o cadastro foi realizado.</span></label>
       <div className="registration-confirm-actions">
        <button type="button" className="registration-cancel" disabled={saving} onClick={()=>setOpenId('')}>Cancelar</button>
        <button type="button" className="registration-confirm" disabled={saving||!checked||reference.trim().length<3} onClick={()=>void confirm(company)}>
         <CheckCircle2 size={18}/>{saving?'Confirmando...':'Confirmar cadastro sindical'}</button>
       </div>
      </div>}
     </article>)}
     {!items.length&&<div className="registration-empty"><CheckCircle2 size={30}/>
      <strong>{loading?'Carregando empresas...':view==='pending'?'Nenhuma empresa aguardando conferência':'Nenhum cadastro confirmado'}</strong>
      <p>{loading?'Consultando os registros.':query?'Tente outra busca.':view==='pending'?'Empresas validadas e ainda não confirmadas aparecerão aqui.':'A confirmação pela equipe de Cadastro será exibida aqui.'}</p>
     </div>}
    </div>
    <div className="registration-pagination">
     <button type="button" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/> Anterior</button>
     <span>Página {page}</span>
     <button type="button" disabled={!hasMore||loading} onClick={()=>setPage(p=>p+1)}>Próxima <ChevronRight size={18}/></button>
    </div>
   </section>
  </div>
 </Portal>;
}
