'use client';
import {useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {ClipboardCheck,Camera,Check,RotateCcw,XCircle,ShieldCheck} from 'lucide-react';
type Row={id:string;legal_name:string;cnpj:string;city:string;agent_name:string;result:string;notes:string|null;review_status:string;operating_status:string|null;signage_status:string|null;regularity_note:string|null;accuracy_m:number|null;distance_m:number|null;evidence_id:string|null};
const operating:Record<string,string>={operating:'Funcionando',closed:'Fechada',moved:'Mudou de endereço',unknown:'Não confirmado'};
const regularity:Record<string,string>={none_observed:'Sem situação aparente',attention:'Atenção necessária',not_evaluated:'Não avaliada'};
export default function Validacoes(){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[reasons,setReasons]=useState<Record<string,string>>({});
 async function load(){const r=await fetch('/api/validacoes',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Falha na consulta.');setRows(d.items||[])}
 useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
 async function decide(id:string,decision:string){
  setBusy(id);setError('');setNotice('');
  try{
   const r=await fetch('/api/validacoes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,decision,reason:reasons[id]||''})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Falha na validação');
   setNotice(d.cleanup_pending?'Decisão registrada, mas o arquivo ainda aguarda a rotina automática de exclusão.':'Análise registrada. A foto foi removida quando aplicável.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Falha na operação')}
  finally{setBusy('')}
 }
 const pending=rows.filter(x=>x.review_status==='pending');
 return <Portal title="Central de validação" subtitle="Confira foto, localização e respostas antes de aprovar cada visita.">
 <section className="panel" style={{marginBottom:20}}>
 <div className="panel-title"><div><small>CONFERÊNCIA DAS VISITAS</small><h2>{pending.length} visita(s) aguardando análise</h2></div><ClipboardCheck size={23}/></div>
 <p className="muted" style={{fontSize:16,lineHeight:1.6}}>A fotografia é temporária e acessível somente a usuários autorizados. Após aprovar ou recusar, o sistema solicita a exclusão física do arquivo. O registro da visita e a decisão administrativa permanecem.</p>
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
 <div style={{display:'grid',gap:18,marginTop:22}}>
 {pending.map(x=><article key={x.id} style={{border:'1px solid var(--line)',borderRadius:17,padding:20,display:'grid',gap:15}}>
  <div><strong style={{fontSize:22}}>{x.legal_name}</strong><p className="muted" style={{margin:'6px 0',fontSize:15}}>{x.cnpj} · {x.city} · Agente: {x.agent_name}</p></div>
  {x.evidence_id?<div style={{maxWidth:620}}><div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,fontSize:16,fontWeight:700}}><Camera size={19}/> Foto da fachada</div>
   <a href={'/api/campo/foto/'+x.evidence_id} target="_blank" rel="noopener noreferrer" title="Ampliar fotografia em uma nova aba autenticada">
    <img src={'/api/campo/foto/'+x.evidence_id} alt={'Fachada registrada durante a visita a '+x.legal_name} style={{display:'block',width:'100%',maxHeight:360,objectFit:'contain',background:'#f3f4f2',borderRadius:12,border:'1px solid var(--line)'}}/>
   </a><p className="muted" style={{fontSize:13}}>Clique na imagem para ampliar. O arquivo não permanecerá após a decisão.</p></div>
   :<div style={{padding:15,background:'#fff8eb',borderRadius:10,color:'#8b632f'}}><Camera size={19} style={{verticalAlign:'middle'}}/> Sem fotografia disponível (visita antiga ou prazo de retenção encerrado).</div>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:11}}>
   <div><small className="muted">Funcionamento</small><div style={{fontSize:17,fontWeight:700}}>{operating[x.operating_status||'']||x.result||'Não informado'}</div></div>
   <div><small className="muted">Identificação visível</small><div style={{fontSize:17,fontWeight:700}}>{x.signage_status==='yes'?'Sim':x.signage_status==='no'?'Não':'Não informado'}</div></div>
   <div><small className="muted">Regularidade aparente</small><div style={{fontSize:17,fontWeight:700}}>{regularity[x.regularity_note||'']||'Não informada'}</div></div>
  </div>
  {x.notes&&<div><strong>Observações do agente</strong><p style={{fontSize:16,marginTop:8,whiteSpace:'pre-wrap'}}>{x.notes}</p></div>}
  {x.distance_m!==null?<div style={{fontSize:15,color:x.distance_m>500?'#a25320':'#315e4b'}}>
    Localização de chegada a aproximadamente <strong>{Math.round(x.distance_m)} m</strong> da coordenada da empresa · precisão do GPS: ±{Math.round(Number(x.accuracy_m||0))} m.
    <p className="muted" style={{fontSize:13,marginTop:5}}>A geocodificação pode ser aproximada. Essa distância não comprova nem invalida a visita isoladamente.</p>
   </div>:<p className="muted">Comparação entre GPS e endereço ainda não disponível.</p>}
  <div><label htmlFor={'reason-'+x.id} style={{fontWeight:700,fontSize:16}}>Motivo, caso solicite ajustes ou recuse</label>
  <textarea id={'reason-'+x.id} className="field" rows={3} style={{display:'block',width:'100%',marginTop:7,fontSize:16}} maxLength={1000} placeholder="Explique ao agente o que precisa ser revisto." value={reasons[x.id]||''} onChange={e=>setReasons(p=>({...p,[x.id]:e.target.value}))}/></div>
  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
   <button className="button" style={{minHeight:54}} disabled={!!busy} onClick={()=>void decide(x.id,'approved')}><Check size={19}/> Aprovar visita</button>
   <button className="button secondary" style={{minHeight:54}} disabled={!!busy||!reasons[x.id]||reasons[x.id].trim().length<8} onClick={()=>void decide(x.id,'needs_more')}><RotateCcw size={18}/> Solicitar ajuste</button>
   <button className="button secondary" style={{minHeight:54}} disabled={!!busy||!reasons[x.id]||reasons[x.id].trim().length<8} onClick={()=>void decide(x.id,'rejected')}><XCircle size={18}/> Recusar</button>
  </div>
 </article>)}
 {!pending.length&&<div className="empty"><div><ShieldCheck size={34}/><strong>Tudo analisado por enquanto</strong><p>As próximas visitas enviadas pelos agentes aparecerão aqui.</p></div></div>}
 </div></section>
 </Portal>;
}
