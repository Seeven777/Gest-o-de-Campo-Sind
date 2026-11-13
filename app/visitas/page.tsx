'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Portal} from '@/components/portal';
import {Navigation,Camera,ClipboardCheck,Clock3} from 'lucide-react';

type Route={id:string;campaign_name:string;route_date:string;stops:number;status:string};
type Visit={id:string;legal_name:string;agent_name:string;result:string;review_status:string;checkin_at:string|null;checkout_at:string|null};
const resultLabels:Record<string,string>={
 located:'Localizada',closed:'Fechada',moved:'Mudou de endereço',not_found:'Não encontrada',
 out_of_scope:'Fora do setor pet',not_completed:'Não concluída',pending:'Em andamento'};
const reviewLabels:Record<string,string>={pending:'Aguardando validação',approved:'Validada',rejected:'Recusada',needs_more:'Ajustes solicitados'};
function formatDate(s:string){const day=String(s||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(day)?day.split('-').reverse().join('/'):day||'—'}

export default function Visitas(){
 const [agent,setAgent]=useState<boolean|null>(null);
 const [routes,setRoutes]=useState<Route[]>([]);
 const [visits,setVisits]=useState<Visit[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [showHistory,setShowHistory]=useState(false);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const me=await fetch('/api/me',{cache:'no-store'});
    const profile=await me.json().catch(()=>({}));
    if(!me.ok||!profile.user?.role)throw Error(profile.error||'Entre novamente para consultar suas visitas.');
    const isAgent=profile.user.role==='agent';
    if(active)setAgent(isAgent);
    const endpoints=isAgent?['/api/rotas','/api/visitas']:['/api/visitas'];
    const responses=await Promise.all(endpoints.map(url=>fetch(url,{cache:'no-store'})));
    const data=await Promise.all(responses.map(r=>r.json().catch(()=>({}))));
    const failed=responses.findIndex(r=>!r.ok);
    if(failed>=0)throw Error(data[failed].error||'Não foi possível consultar as visitas. Tente novamente.');
    if(!active)return;
    if(isAgent){setRoutes(data[0].items||[]);setVisits(data[1].items||[])}
    else setVisits(data[0].items||[]);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Erro ao abrir visitas.')}
   finally{if(active)setLoading(false)}
  })();
  return()=>{active=false};
 },[]);
 return <Portal title={agent?'Minhas visitas':'Visitas registradas'}
  subtitle={agent?'Comece uma jornada e acompanhe as visitas que você já enviou.':'Acompanhe os registros enviados pelas equipes.'}>
  {error&&<p className="error" role="alert">{error}</p>}
  {loading?<section className="panel" role="status"><Clock3 size={23}/> Carregando visitas e jornadas...</section>:
  agent===null?<section className="panel" role="status">Não foi possível confirmar seu perfil. Entre novamente no sistema.</section>:
  agent?<>
   <section className="panel" style={{marginBottom:18}}>
    <div className="panel-title"><div><small>SUAS ROTAS</small><h2>Registrar nova visita</h2></div><Navigation size={22}/></div>
    <p className="muted" style={{fontSize:14,lineHeight:1.6}}>Escolha a rota. Ao chegar à empresa e estacionar, siga as etapas de registro.</p>
    <div style={{display:'grid',gap:12,marginTop:18}}>
     {routes.filter(r=>r.status!=='completed').map(r=><div key={r.id} style={{padding:18,border:'1px solid var(--line)',borderRadius:15,display:'grid',gap:9}}>
       <strong style={{fontSize:19}}>{r.campaign_name}</strong>
       <span className="muted">{r.stops} empresas · {formatDate(r.route_date)}</span>
       <Link className="button" style={{minHeight:56,justifyContent:'center',fontSize:17}} href={'/campo/'+r.id}>
        <Camera size={20}/> {r.status==='in_progress'?'Continuar jornada':'Abrir jornada guiada'}
       </Link>
      </div>)}
     {!routes.some(r=>r.status!=='completed')&&<div className="empty"><div><Navigation size={29}/><strong>Sem jornada pendente</strong><p>Quando uma nova rota for publicada para você, ela aparecerá aqui.</p></div></div>}
    </div>
   </section>
   <section className="panel ops-visit-history">
    <div className="panel-title"><div><small>ACOMPANHAMENTO</small><h2>Meu histórico de visitas</h2></div><button className="button secondary" type="button" aria-expanded={showHistory} onClick={()=>setShowHistory(x=>!x)}>{showHistory?"Ocultar histórico":"Ver histórico"} ({visits.length})</button></div>
    {showHistory&&<>
    <p className="muted">A central analisa suas respostas. Uma visita enviada pode continuar aguardando validação.</p>
    <div className="tablewrap"><table><thead><tr><th>Empresa</th><th>Chegada</th><th>Resultado</th><th>Situação</th></tr></thead><tbody>
     {visits.map(x=><tr key={x.id}><td><strong>{x.legal_name}</strong></td><td>{x.checkin_at?formatDate(x.checkin_at):'—'}</td>
      <td>{x.checkout_at?(resultLabels[x.result]||x.result):'Em andamento'}</td>
      <td>{x.checkout_at?(reviewLabels[x.review_status]||x.review_status):'Formulário pendente'}</td></tr>)}
     {!visits.length&&<tr><td colSpan={4}>Você ainda não possui visitas registradas.</td></tr>}
    </tbody></table></div></>}
   </section>
  </>:
  <section className="panel">
   <div className="panel-title"><div><small>HISTÓRICO OPERACIONAL</small><h2>Visitas da equipe</h2></div><ClipboardCheck size={22}/></div>
   <p className="muted">Novas visitas são registradas pela Jornada Guiada. Para aprovar fotografias e observações, acesse <Link href="/validacoes" className="link-inline">Central de validação</Link>.</p>
   <div className="tablewrap"><table><thead><tr><th>Empresa</th><th>Agente</th><th>Resultado</th><th>Revisão</th></tr></thead><tbody>
    {visits.map(x=><tr key={x.id}><td>{x.legal_name}</td><td>{x.agent_name}</td><td>{resultLabels[x.result]||x.result}</td><td>{reviewLabels[x.review_status]||x.review_status}</td></tr>)}
    {!visits.length&&<tr><td colSpan={4}>Nenhum registro ainda.</td></tr>}
   </tbody></table></div>
  </section>}
 </Portal>
}