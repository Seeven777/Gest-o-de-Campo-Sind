'use client';
import {useCallback,useEffect,useState} from 'react';
import {Coffee,CheckCircle2,ChevronDown,ChevronUp,RefreshCw,XCircle} from 'lucide-react';

type BreakRequest={id:string;route_id:string;agent_name:string;reason_label:string;note:string|null;
 status:string;created_at:string;decision_note:string|null;decided_at:string|null};

export function CentralBreakRequests(){
 const [rows,setRows]=useState<BreakRequest[]>([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  const r=await fetch('/api/campo/parada',{cache:'no-store'});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'Falha ao consultar solicitações de parada.');
  setRows(d.items||[]);
 },[]);
 useEffect(()=>{
  let alive=true;
  void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Consulta indisponível.')})
   .finally(()=>{if(alive)setLoading(false)});
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load().catch(()=>{})},40000);
  return()=>{alive=false;window.clearInterval(timer)};
 },[load]);
 const pending=rows.filter(x=>x.status==='pending');
 async function decide(row:BreakRequest,decision:'approved'|'denied'){
  if(decision==='denied'&&(reasons[row.id]||'').trim().length<8)return;
  setBusy(row.id);setError('');setNotice('');
  try{
   const r=await fetch('/api/campo/parada',{method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({request_id:row.id,decision,note:reasons[row.id]||''})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao registrar decisão.');
   setNotice('Decisão operacional registrada e disponível para consulta do agente.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao responder ao agente.')}
  finally{setBusy('')}
 }
 return <section className="panel" style={{marginBottom:16,padding:18}}>
  <div className="panel-title" style={{marginBottom:8}}>
   <div><small>COMUNICAÇÃO COM A EQUIPE</small><h2>Solicitações de parada {loading?'':'('+pending.length+')'}</h2></div>
   <Coffee size={24} color="#df7021"/>
  </div>
  <p className="muted" style={{fontSize:13,lineHeight:1.5,margin:'3px 0 12px'}}>
   Pedidos operacionais para alimentação, abastecimento ou outras necessidades. Este controle não substitui os intervalos e direitos aplicáveis ao trabalhador.
  </p>
  <button type="button" className="button secondary" aria-expanded={open} onClick={()=>setOpen(x=>!x)}
   style={{minHeight:45,display:'inline-flex',gap:8,alignItems:'center'}}>
   {open?'Ocultar pedidos':'Conferir pedidos'} {open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {error&&<p className="error" role="alert" style={{marginTop:12}}>{error}</p>}
  {notice&&<p className="success" role="status" style={{marginTop:12}}>{notice}</p>}
  {open&&<div style={{display:'grid',gap:12,marginTop:16}}>
   <button type="button" className="button secondary" disabled={loading||!!busy}
    style={{justifySelf:'start',minHeight:44}} onClick={()=>void load().catch(e=>setError(e.message))}>
    <RefreshCw size={16}/> Atualizar
   </button>
   {pending.map(row=><article key={row.id}
    style={{border:'1px solid #e0e9e1',background:'#fff',borderRadius:14,padding:15,display:'grid',gap:10}}>
    <div><strong style={{fontSize:16,color:'#24533a'}}>{row.agent_name}</strong>
     <p style={{margin:'4px 0',fontSize:13,color:'#64756c'}}>
      {row.reason_label} · {new Date(row.created_at).toLocaleString('pt-BR')}</p>
     {row.note&&<p style={{margin:'6px 0',fontSize:14}}>{row.note}</p>}
    </div>
    <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
     <button type="button" className="button" disabled={!!busy}
      onClick={()=>void decide(row,'approved')}><CheckCircle2 size={17}/> Autorizar ajuste de percurso</button>
    </div>
    <label style={{fontSize:13,fontWeight:700}}>Caso não autorize, informe a justificativa
     <textarea className="field" rows={2} maxLength={500} value={reasons[row.id]||''}
      onChange={e=>setReasons(x=>({...x,[row.id]:e.target.value}))}
      placeholder="Justifique a decisão, sem restringir intervalos previstos em lei."
      style={{display:'block',width:'100%',marginTop:6}}/>
    </label>
    <button type="button" className="button secondary" disabled={!!busy||(reasons[row.id]||'').trim().length<8}
     style={{justifySelf:'start'}} onClick={()=>void decide(row,'denied')}><XCircle size={17}/> Não autorizar alteração da rota</button>
   </article>)}
   {!pending.length&&<p className="muted" style={{textAlign:'center',padding:'18px 0'}}>Nenhuma solicitação aguardando análise.</p>}
  </div>}
 </section>;
}
