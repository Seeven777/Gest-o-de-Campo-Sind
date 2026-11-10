'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';
import {Portal} from '@/components/portal';import {Navigation,Camera,ClipboardCheck} from 'lucide-react';
type Route={id:string;campaign_name:string;route_date:string;stops:number;status:string};
type Visit={id:string;legal_name:string;agent_name:string;result:string;review_status:string;checkout_at:string|null};
export default function Visitas(){
 const [agent,setAgent]=useState<boolean|null>(null),[routes,setRoutes]=useState<Route[]>([]),[visits,setVisits]=useState<Visit[]>([]),[error,setError]=useState('');
 useEffect(()=>{
  void fetch('/api/me',{cache:'no-store'}).then(async r=>{const j=await r.json();return j.user?.role==='agent'}).then(async role=>{
   setAgent(role);
   const endpoint=role?'/api/rotas':'/api/visitas';const r=await fetch(endpoint,{cache:'no-store'});const data=await r.json();
   if(!r.ok)throw Error(data.error||'Erro ao carregar');
   if(role)setRoutes(data.items||[]);else setVisits(data.items||[]);
  }).catch(e=>setError(e instanceof Error?e.message:'Erro ao abrir visitas'));
 },[]);
 return <Portal title={agent?'Registrar visita':'Visitas registradas'} subtitle={agent?'Acesse sua jornada e siga o passo a passo com foto e GPS.':'Acompanhe os registros enviados pelas equipes.'}>
 {error&&<p className="error" role="alert">{error}</p>}
 {agent===null?<section className="panel">Carregando informações...</section>:agent?
 <section className="panel"><div className="panel-title"><div><small>SUAS ROTAS</small><h2>Onde você vai trabalhar?</h2></div><Navigation size={22}/></div>
 <p className="muted" style={{fontSize:17,lineHeight:1.6}}>Escolha a rota. O sistema irá mostrar o caminho, pedir sua confirmação de chegada e orientar a foto e o formulário. Não é necessário preencher várias telas ao mesmo tempo.</p>
 <div style={{display:'grid',gap:14,marginTop:20}}>{routes.map(r=><div key={r.id} style={{padding:20,border:'1px solid var(--line)',borderRadius:15,display:'grid',gap:12}}>
 <strong style={{fontSize:21}}>{r.campaign_name}</strong><span style={{fontSize:17}}>{r.stops} empresas · {String(r.route_date).slice(0,10)}</span>
 <Link className="button" style={{minHeight:60,justifyContent:'center',fontSize:19}} href={'/campo/'+r.id}><Camera size={22}/> Abrir jornada guiada</Link></div>)}
 {!routes.length&&<div className="empty"><div><Camera size={34}/><strong>Sem rota atribuída</strong><p>Consulte a administração para receber uma rota de campo.</p></div></div>}</div>
 </section>
 :<section className="panel"><div className="panel-title"><div><small>HISTÓRICO OPERACIONAL</small><h2>Visitas realizadas</h2></div><ClipboardCheck size={22}/></div>
 <p className="muted">Novas visitas são registradas exclusivamente pela Jornada Guiada. Para aprovar fotografias e observações, utilize <Link href="/validacoes" className="link-inline">Central de validação</Link>.</p>
 <div className="tablewrap"><table><thead><tr><th>Empresa</th><th>Agente</th><th>Resultado</th><th>Revisão</th></tr></thead><tbody>
 {visits.map(x=><tr key={x.id}><td>{x.legal_name}</td><td>{x.agent_name}</td><td>{x.result}</td><td>{x.review_status}</td></tr>)}{!visits.length&&<tr><td colSpan={4}>Nenhum registro ainda.</td></tr>}</tbody></table></div></section>}
 </Portal>;
}
