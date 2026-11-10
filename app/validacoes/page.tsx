'use client';
import {useEffect,useState} from 'react';import {Portal} from '@/components/portal';import {ClipboardCheck} from 'lucide-react';
type Row={id:string;legal_name:string;cnpj:string;city:string;agent_name:string;result:string;notes:string;review_status:string};
export default function Validacoes(){const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
async function load(){const r=await fetch('/api/validacoes',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.items||[])}
useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
async function decide(id:string,decision:string){setBusy(id);setError('');setNotice('');try{const r=await fetch('/api/validacoes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,decision})});const d=await r.json();if(!r.ok)throw Error(d.error);setNotice('Análise registrada e auditada.');await load()}catch(e){setError(e instanceof Error?e.message:'Erro')}finally{setBusy('')}}
return <Portal title="Validações" subtitle="Avalie os resultados informados pelas equipes de campo.">
<section className="panel"><div className="panel-title"><div><small>CONFERÊNCIA</small><h2>Visitas aguardando decisão</h2></div><ClipboardCheck size={22}/></div>
<p className="muted">Esta versão permite revisar resultados e observações. A análise obrigatória de fotografias será habilitada após o armazenamento privado de evidências.</p>
{error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success">{notice}</p>}
<div style={{display:'grid',gap:12}}>{rows.filter(x=>x.review_status==='pending').map(x=><div key={x.id} style={{border:'1px solid var(--line)',borderRadius:13,padding:18,display:'grid',gap:9}}><strong>{x.legal_name} · {x.city}</strong><span className="muted">CNPJ: {x.cnpj} · Agente: {x.agent_name}</span><span>Resultado: {x.result}</span><p className="muted">{x.notes||'Sem observações'}</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="button" disabled={!!busy} onClick={()=>void decide(x.id,'approved')}>Aprovar</button><button className="button secondary" disabled={!!busy} onClick={()=>void decide(x.id,'needs_more')}>Solicitar revisão</button><button className="button secondary" disabled={!!busy} onClick={()=>void decide(x.id,'rejected')}>Rejeitar</button></div></div>)}
{!rows.some(x=>x.review_status==='pending')&&<div className="empty">Não há visitas aguardando revisão.</div>}</div></section></Portal>}
