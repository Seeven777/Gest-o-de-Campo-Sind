'use client';
import {useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {FieldNavigationMap,type FieldPlan} from '@/components/field-navigation-map';
import {MapPin,RefreshCw,ShieldCheck} from 'lucide-react';
import '../campo/jornada.css';
type Agent={agent_id:string;route_id:string;name:string;campaign:string;lat:number;lon:number;accuracy_m:number;last_seen_at:string};
export default function Localizacoes(){
 const [items,setItems]=useState<Agent[]>([]),[error,setError]=useState(''),[updated,setUpdated]=useState('');
 async function refresh(){
  try{const r=await fetch('/api/campo/localizacao',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Acesso negado');setItems(d.items||[]);setUpdated(new Date().toLocaleTimeString('pt-BR'));setError('')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar o GPS.')}
 }
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),15000);return()=>window.clearInterval(timer)},[]);
 const plan:FieldPlan={order:items.map(x=>x.agent_id),points:items.map(x=>({id:x.agent_id,lat:Number(x.lat),lon:Number(x.lon)})),geometry:{type:'LineString',coordinates:[]}};
 return <Portal title="Equipe em campo" subtitle="Localização atual compartilhada voluntariamente durante a jornada.">
 <section className="panel"><div className="panel-title"><div><small>ACOMPANHAMENTO OPERACIONAL</small><h2>Quem está com GPS ativo?</h2></div><MapPin size={23}/></div>
 <div className="field-privacy"><ShieldCheck size={22}/><span>O mapa mostra somente a última posição recebida há menos de dois minutos. Não exibe trajetos históricos, agentes sem consentimento ou quem interrompeu o compartilhamento. Atualização a cada 15 segundos.</span></div>
 {error&&<p className="field-error" role="alert">{error}</p>}
 <div style={{display:'flex',gap:10,justifyContent:'space-between',flexWrap:'wrap',alignItems:'center',margin:'18px 0'}}>
 <strong style={{fontSize:19}}>{items.length} agente(s) com sinal recente</strong>
 <button className="button secondary" onClick={()=>void refresh()}><RefreshCw size={17}/> Atualizar</button>
 </div>
 {items.length?<><FieldNavigationMap plan={plan} compact/><div style={{display:'grid',gap:12,marginTop:18}}>{items.map((x,i)=><div key={x.agent_id} style={{padding:16,border:'1px solid var(--line)',borderRadius:13,display:'flex',gap:13,alignItems:'start'}}>
 <span style={{background:'#ed6c28',borderRadius:'100%',width:38,height:38,color:'white',fontWeight:800,display:'inline-flex',justifyContent:'center',alignItems:'center',flexShrink:0}}>{i+1}</span>
 <div><strong style={{fontSize:18}}>{x.name}</strong><p className="muted" style={{margin:'5px 0'}}>Campanha: {x.campaign}</p><small>Última localização: {new Date(x.last_seen_at).toLocaleTimeString('pt-BR')} · Precisão informada: ±{Math.round(Number(x.accuracy_m))} m</small></div></div>)}</div></>:<div className="empty"><div><MapPin size={35}/><strong>Sem localizações ativas agora</strong><p>Os agentes aparecem aqui somente após iniciarem o GPS na jornada e enquanto os sinais continuarem chegando.</p></div></div>}
 {updated&&<p className="muted" style={{marginTop:14}}>Última atualização da central: {updated}</p>}
 </section>
 </Portal>;
}
