'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {authClient} from '@/lib/auth/client';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,MapPin,RefreshCw,Route as RouteIcon,LogOut,X} from 'lucide-react';
import {Portal} from '@/components/portal';
import {FieldNavigationMap,type FieldPlan} from '@/components/field-navigation-map';
import '../campo/equipe.css';
import '../campo/equipe-motion.css';

type AssignedRoute={id:string;route_date:string;status:string;campaign_name:string;stops:number};
const ambientPlan:FieldPlan={order:[],points:[{id:'sao-paulo',lat:-23.5505,lon:-46.6333}],geometry:{type:'LineString',coordinates:[]}};
const formatDate=(d:string)=>String(d).slice(0,10).split('-').reverse().join('/');
export default function Agent(){
 const router=useRouter();
 const [routes,setRoutes]=useState<AssignedRoute[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[showRoutes,setShowRoutes]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let alive=true;
  fetch('/api/rotas',{cache:'no-store'}).then(async r=>{
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível consultar suas rotas.');
   if(alive){setRoutes(d.items||[]);setError('')}
  }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Erro ao consultar rotas.')})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[retry]);
 const active=useMemo(()=>routes.filter(r=>['published','in_progress'].includes(r.status)).sort((a,b)=>{
  const aRank=a.status==='in_progress'?0:1,bRank=b.status==='in_progress'?0:1;
  return aRank-bRank||a.route_date.localeCompare(b.route_date);
 }),[routes]);
 const next=active[0],completed=routes.filter(r=>r.status==='completed').length;
 return <Portal title="Minha equipe" immersive>
  <main className="crew-root crew-home" aria-label="Jornada da equipe">
   <div className="crew-ambient-map" aria-hidden="true"><FieldNavigationMap plan={ambientPlan} immersive/></div>
   <div className="crew-map-wash" aria-hidden="true"/>
   <button type="button" className="crew-session-button" title="Sair da conta" aria-label="Sair da conta" onClick={async()=>{if(window.confirm("Deseja sair da sua conta?")){await authClient.signOut();router.replace("/login")}}}><LogOut size={19}/></button>
   <div className="crew-top-badge crew-top-badge-light">{loading?'CONSULTANDO ROTAS':active.length+' '+(active.length===1?'ROTA DISPONÍVEL':'ROTAS DISPONÍVEIS')}</div>
   {error&&<div className="crew-floating-error" role="alert">{error}
     <button type="button" onClick={()=>{setLoading(true);setRetry(v=>v+1)}}><RefreshCw size={18}/> Tentar novamente</button>
   </div>}
   {!loading&&!error&&!next&&<div className="crew-center-message" role="status">
    <CheckCircle2 size={30}/>
    <strong>{completed?'ESTAMOS VALIDANDO AS INFORMAÇÕES ENVIADAS.':'AGUARDANDO LIBERAÇÃO DE ROTAS.'}</strong>
    <p>{completed?'A central está analisando suas visitas.':'Quando a central publicar sua próxima rota, ela aparecerá aqui.'}</p>
   </div>}
   {next&&<div className="crew-home-current" aria-label="Próxima rota">
    <span>SEU PRÓXIMO PERCURSO</span>
    <strong>{next.campaign_name||'Rota de campo'}</strong>
    <small>{formatDate(next.route_date)} · {next.stops} {next.stops===1?'empresa':'empresas'}</small>
   </div>}
   <footer className="crew-home-footer">
    {next?<Link className="crew-primary" href={'/campo/'+next.id}>
      {next.status==='in_progress'?'CONTINUAR PERCURSO':'INICIAR PERCURSO'} <ArrowRight size={22}/>
     </Link>:<button type="button" className="crew-primary" disabled>{loading?'CONSULTANDO ROTAS...':'AGUARDANDO PRÓXIMA ROTA'}</button>}
    {active.length>1&&<button type="button" className="crew-extra-link" onClick={()=>setShowRoutes(true)}>
      <RouteIcon size={16}/> Ver minhas {active.length} rotas
     </button>}
    {!next&&!loading&&<button type="button" className="crew-extra-link" onClick={()=>{setLoading(true);setRetry(v=>v+1)}}>
      <RefreshCw size={16}/> Atualizar rotas
     </button>}
   </footer>
   {showRoutes&&<div className="crew-dialog-backdrop">
    <section className="crew-dialog" role="dialog" aria-modal="true" aria-labelledby="crew-routes-title">
     <button type="button" className="crew-dialog-x" onClick={()=>setShowRoutes(false)} aria-label="Fechar"><X size={21}/></button>
     <span className="crew-eyebrow">PERCURSOS ATRIBUÍDOS</span><h2 id="crew-routes-title">Escolha uma rota</h2>
     <div className="crew-route-options">{active.map(r=><Link key={r.id} href={'/campo/'+r.id} className="crew-route-option">
      <MapPin size={21}/><span><strong>{r.campaign_name}</strong><small>{formatDate(r.route_date)} · {r.stops} paradas</small></span><ArrowRight size={18}/>
     </Link>)}</div>
    </section>
   </div>}
  </main>
 </Portal>;
}
