'use client';
import {useEffect,useState} from 'react';import {Portal} from '@/components/portal';import {MapPin,Camera} from 'lucide-react';
type Stop={stop_id:string;legal_name:string;trade_name:string;city:string;street:string;route_date:string;checkin_at:string|null;checkout_at:string|null};
type Visit={id:string;legal_name:string;result:string;review_status:string;checkin_at:string;checkout_at:string};
const results=[['located','Empresa localizada'],['closed','Fechada no momento'],['moved','Mudou de endereço'],['not_found','Não localizada'],['out_of_scope','Fora do setor'],['not_completed','Visita não concluída']];
export default function Visitas(){const [stops,setStops]=useState<Stop[]>([]),[visits,setVisits]=useState<Visit[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[notes,setNotes]=useState<Record<string,string>>({}),[result,setResult]=useState<Record<string,string>>({});
async function load(){const r=await fetch('/api/visitas',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setStops(d.stops||[]);setVisits(d.items||[])}
useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
async function act(s:Stop,action:'checkin'|'checkout'){setBusy(true);setError('');setMessage('');try{
 let payload:Record<string,unknown>={stop_id:s.stop_id,action};
 if(action==='checkin'){const pos=await new Promise<GeolocationPosition>((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('Este dispositivo não suporta GPS.'));navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0})});payload={...payload,lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy}}
 else payload={...payload,result:result[s.stop_id]||'located',notes:notes[s.stop_id]||''};
 const r=await fetch('/api/visitas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||'Falha na visita');setMessage(action==='checkin'?'Chegada registrada com GPS.':'Visita concluída e enviada para análise.');await load();
 }catch(e){setError(e instanceof Error?e.message:'Erro na operação')}finally{setBusy(false)}}
return <Portal title="Visitas" subtitle="Registre sua presença e encaminhe resultados para validação.">
<section className="panel" style={{marginBottom:18}}><div className="panel-title"><div><small>TRABALHO DE CAMPO</small><h2>Paradas atribuídas</h2></div><MapPin size={22}/></div>
<p className="muted">O check-in registra horário e coordenadas com permissão do dispositivo. Fotos e check-out com GPS ainda dependem da implementação de armazenamento seguro.</p>
{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
<div style={{display:'grid',gap:12}}>{stops.map(s=><div key={s.stop_id} style={{padding:16,border:'1px solid var(--line)',borderRadius:13}}>
<div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><strong>{s.trade_name||s.legal_name}</strong><p className="muted" style={{marginTop:5}}>{s.street}, {s.city} · {String(s.route_date).slice(0,10)}</p></div><span className="pill warn">{s.checkout_at?'Concluída':s.checkin_at?'Em andamento':'Pendente'}</span></div>
{!s.checkin_at&&!s.checkout_at?<button disabled={busy} className="button" onClick={()=>void act(s,'checkin')}><MapPin size={16}/> Fazer check-in</button>:s.checkin_at&&!s.checkout_at?<div className="form-grid"><label>Resultado<select className="field" value={result[s.stop_id]||'located'} onChange={e=>setResult(p=>({...p,[s.stop_id]:e.target.value}))}>{results.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Observações<textarea className="field" style={{width:'100%'}} maxLength={2000} value={notes[s.stop_id]||''} onChange={e=>setNotes(p=>({...p,[s.stop_id]:e.target.value}))}/></label><button className="button" disabled={busy} onClick={()=>void act(s,'checkout')}>Concluir visita</button></div>:<p className="success">Visita registrada</p>}</div>)}
{!stops.length&&<div className="empty"><div><Camera size={29}/><strong>Nenhuma parada atribuída</strong><p>Crie uma rota em Campanhas &gt; Rotas para começar.</p></div></div>}
</div></section>
<section className="panel"><div className="panel-title"><div><small>HISTÓRICO</small><h2>Visitas registradas</h2></div></div><div className="tablewrap"><table><thead><tr><th>Empresa</th><th>Resultado</th><th>Análise</th></tr></thead><tbody>{visits.map(v=><tr key={v.id}><td>{v.legal_name}</td><td>{v.result}</td><td>{v.review_status}</td></tr>)}{!visits.length&&<tr><td colSpan={3}>Nenhuma visita registrada.</td></tr>}</tbody></table></div></section></Portal>}
