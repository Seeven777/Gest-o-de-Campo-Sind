'use client';
import {useCallback,useEffect,useState} from 'react';
import {Coffee,ChevronDown,ChevronUp,RefreshCw,Clock3} from 'lucide-react';

type BreakRecord={id:string;route_id:string;agent_name:string;reason_label:string;
 note:string|null;status:'recorded';created_at:string;expense_hint:string|null;gps_accuracy_m:string|null};

/** Histórico somente leitura. O agente registra a parada sem aprovação da central. */
export function CentralBreakRequests(){
 const [rows,setRows]=useState<BreakRecord[]>([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  const r=await fetch('/api/campo/parada',{cache:'no-store'});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'Falha ao consultar registros de parada.');
  setRows(d.items||[]);setError('');
 },[]);
 useEffect(()=>{
  let alive=true;
  void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Consulta indisponível.')})
   .finally(()=>{if(alive)setLoading(false)});
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load().catch(()=>{})},60000);
  return()=>{alive=false;window.clearInterval(timer)};
 },[load]);
 return <section className="panel" style={{marginBottom:16,padding:18}}>
  <div className="panel-title" style={{marginBottom:8}}>
   <div><small>HISTÓRICO DA EQUIPE</small><h2>Paradas registradas {loading?'':'('+rows.length+')'}</h2></div>
   <Coffee size={24} color="#df7021"/>
  </div>
  <p className="muted" style={{fontSize:13,lineHeight:1.5,margin:'3px 0 12px'}}>
   A equipe registra suas pausas diretamente, com data e hora, sem precisar de aprovação.
   Gastos eventualmente declarados ainda precisam de solicitação e conferência de reembolso pelo RH.
  </p>
  <button type="button" className="button secondary" aria-expanded={open} onClick={()=>setOpen(x=>!x)}
   style={{minHeight:48,display:'inline-flex',gap:8,alignItems:'center'}}>
   {open?'Ocultar histórico':'Consultar registros'} {open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {error&&<p className="error" role="alert" style={{marginTop:12}}>{error}</p>}
  {open&&<div style={{display:'grid',gap:12,marginTop:16}}>
   <button type="button" className="button secondary" disabled={loading}
    style={{justifySelf:'start',minHeight:45}} onClick={()=>void load().catch(e=>setError(e.message))}>
    <RefreshCw size={16}/> Atualizar
   </button>
   {rows.map(row=><article key={row.id}
    style={{border:'1px solid #e0e9e1',background:'#fff',borderRadius:14,padding:15,display:'grid',gap:7}}>
    <strong style={{fontSize:16,color:'#24533a'}}>{row.agent_name}</strong>
    <div style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:'#63776b'}}>
     <Clock3 size={16} aria-hidden="true"/> {row.reason_label} · {new Date(row.created_at).toLocaleString('pt-BR')}
    </div>
    {row.note&&<p style={{margin:0,fontSize:13,lineHeight:1.5,color:'#4d6353',overflowWrap:'anywhere'}}>{row.note}</p>}
    {row.expense_hint==='true'&&<span style={{fontSize:12,fontWeight:800,color:'#985e29'}}>
     Gasto indicado — aguarda registro separado na área de reembolsos</span>}
    </article>)}
   {!rows.length&&<p className="muted" style={{textAlign:'center',padding:'18px 0'}}>Nenhuma parada registrada neste ambiente.</p>}
  </div>}
 </section>;
}
