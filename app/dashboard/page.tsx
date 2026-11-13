'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {
 ArrowRight,ArrowUpRight,Building2,CheckCheck,ClipboardCheck,Compass,
 FileCheck2,Map,MapPin,Route,ShieldAlert,ShieldCheck,Users,Wallet,
 RefreshCw,Activity
} from 'lucide-react';
import {Portal} from '@/components/portal';
import './overview.css';

type Totals={establishments:number;routes:number;visits:number;validated:number;registrations:number|null;approved_expenses:number};
type Check={label:string;ready:boolean};
const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');
const currency=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function Dashboard(){
 const [data,setData]=useState<Totals|null>(null);
 const [error,setError]=useState(''),[registrationReady,setRegistrationReady]=useState(false);
 const [checks,setChecks]=useState<Check[]|null>(null),[role,setRole]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[refreshKey,setRefreshKey]=useState(0);
 const admin=role==='admin';
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');
  fetch('/api/overview',{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao consultar indicadores.');return d})
   .then(d=>{if(active){setData(d.totals);setRegistrationReady(Boolean(d.registration_ready))}})
   .catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:'Dados indisponíveis.')}})
   .finally(()=>{if(active)setLoading(false)});
  fetch('/api/me',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
   .then(d=>{
    if(!active)return;
    const nextRole=d?.user?.role||null;setRole(nextRole);
    if(nextRole!=='admin'){setChecks(null);return}
    return fetch('/api/admin/prontidao',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
     .then(p=>{if(active)setChecks(Array.isArray(p?.checks)?p.checks:null)});
   }).catch(()=>{if(active)setChecks(null)});
  return()=>{active=false};
 },[refreshKey]);
 const value=(n:number|null|undefined)=>!data||n===null||n===undefined?'—':fmt(n);
 const cards=[
  {title:'Empresas na base',value:data?.establishments,icon:Building2,sub:'Estabelecimentos cadastrados',href:'/empresas',tone:'orange'},
  {title:'Visitas concluídas',value:data?.visits,icon:MapPin,sub:'Atendimentos finalizados em campo',href:'/visitas',tone:'neutral'},
  {title:'Validadas em campo',value:data?.validated,icon:CheckCheck,sub:'Estabelecimentos validados',href:'/validacoes',tone:'neutral'},
  {title:'Cadastros confirmados',value:data?.registrations,icon:ShieldCheck,
   sub:registrationReady?'Com verificação sindical registrada':'Etapa ainda não configurada',href:admin?'/cadastros':'/validacoes',tone:'neutral'},
 ];
 const pending=checks?.filter(c=>!c.ready)||[];
 const steps=[
  {number:'01',title:'Planejar',description:'Distribuir empresas e organizar percursos',href:'/rotas',icon:Route},
  {number:'02',title:'Visitar',description:'Acompanhar as ações realizadas em campo',href:'/visitas',icon:MapPin},
  {number:'03',title:'Validar',description:'Conferir os registros enviados pela equipe',href:'/validacoes',icon:ClipboardCheck},
  ...(admin?[{number:'04',title:'Confirmar',description:'Concluir a conferência sindical externa',href:'/cadastros',icon:FileCheck2}]:[]),
 ];
 return <Portal title="Visão geral" subtitle="Central de acompanhamento da operação de campo.">
  <div className="overview-shell">
   <section className="overview-hero" aria-labelledby="overview-hero-title">
    <div className="overview-hero-content">
     <span className="overview-hero-tag"><span className="overview-live-dot"/> CENTRAL SINDPETSHOP-SP · CAMPO & TERRITÓRIO</span>
     <h2 id="overview-hero-title">A operação em <span>um só lugar.</span></h2>
     <p>Acompanhe o trabalho de campo, identifique as próximas ações e organize a equipe com mais clareza.</p>
     <div className="overview-hero-actions">
      <Link className="overview-hero-primary" href="/rotas"><Route size={18}/> Gerenciar rotas <ArrowRight size={17}/></Link>
      <Link className="overview-hero-secondary" href="/mapa"><Map size={18}/> Explorar território</Link>
     </div>
    </div>
    <div className="overview-hero-aside" aria-label="Resumo de atividade">
     <div className="overview-hero-aside-head"><Activity size={17}/><span>PAINEL DE OPERAÇÕES</span></div>
     <strong>{value(data?.routes)}</strong>
     <span className="overview-hero-aside-caption">rotas registradas na plataforma</span>
     <div className="overview-hero-rule"/>
     <div className="overview-hero-aside-foot"><ShieldCheck size={17}/><span>Dados consultados diretamente na base operacional</span></div>
    </div>
    <div className="overview-hero-orbit" aria-hidden="true"/>
   </section>

   <div className="overview-section-heading">
    <div><span className="overview-kicker">INDICADORES</span><h2>Panorama da operação</h2><p>Totais registrados na plataforma, sem projeções.</p></div>
    <button className="overview-refresh" type="button" disabled={loading} onClick={()=>setRefreshKey(n=>n+1)}>
     <RefreshCw size={16} className={loading?'overview-spinning':''}/>{loading?'Atualizando...':'Atualizar dados'}
    </button>
   </div>
   {error&&<div className="overview-error" role="alert"><ShieldAlert size={18}/><span>Não foi possível atualizar os indicadores: {error}</span></div>}
   <section className="overview-metrics" aria-label="Indicadores operacionais" aria-busy={loading}>
    {cards.map(({title,value:metric,icon:Icon,sub,href,tone})=><Link className={'overview-metric overview-metric-'+tone} href={href} key={title}>
     <div className="overview-metric-top"><span>{title}</span><span className="overview-metric-icon"><Icon size={19} aria-hidden="true"/></span></div>
     <strong aria-label={data&&metric!==null&&metric!==undefined?title+': '+fmt(metric):title+': indisponível'}>{value(metric)}</strong>
     <div className="overview-metric-bottom"><small>{sub}</small><ArrowUpRight size={16} aria-hidden="true"/></div>
    </Link>)}
   </section>

   {admin&&checks&&<section className={'overview-status '+(pending.length?'overview-status-attention':'overview-status-ready')} aria-label="Prontidão dos módulos">
    <div className="overview-status-icon">{pending.length?<ShieldAlert size={21}/>:<ShieldCheck size={21}/>}</div>
    <div className="overview-status-content">
     <strong>{pending.length?'Atenção à configuração dos módulos':'Módulos verificados'}</strong>
     <p>{pending.length
      ?pending.length+' verificação(ões) de prontidão pendente(s). Consulte os detalhes antes de utilizar Cadastro e RH.'
      :'As verificações disponíveis de prontidão não apontam pendências neste momento.'}</p>
    </div>
    <Link href="/configuracoes">Ver detalhes <ArrowRight size={17}/></Link>
   </section>}

   <div className="overview-content-grid">
    <section className="overview-workflow" aria-labelledby="overview-workflow-title">
     <div className="overview-panel-heading">
      <div><span className="overview-kicker">JORNADA DE TRABALHO</span><h2 id="overview-workflow-title">Da rota à confirmação</h2><p>{admin?'Quatro etapas para acompanhar a operação.':'Etapas de acompanhamento de campo.'}</p></div>
      <span className="overview-panel-heading-icon"><Compass size={21}/></span>
     </div>
     <div className="overview-timeline">{steps.map(({number,title,description,href,icon:Icon})=>
      <Link href={href} className="overview-timeline-step" key={number}>
       <span className="overview-timeline-number">{number}</span>
       <span className="overview-timeline-icon"><Icon size={19}/></span>
       <span className="overview-timeline-copy"><strong>{title}</strong><small>{description}</small></span>
       <ArrowRight size={17} className="overview-timeline-arrow"/>
      </Link>)}</div>
    </section>
    <div className="overview-side-panels">
     <section className="overview-territory" aria-labelledby="overview-territory-title">
      <div className="overview-panel-heading"><div><span className="overview-kicker">INTELIGÊNCIA TERRITORIAL</span><h2 id="overview-territory-title">Planeje com proximidade</h2></div><Map size={22}/></div>
      <p>Compare municípios e empresas próximas antes de enviar o agente. A análise de linha reta não substitui o trajeto viário.</p>
      <div className="overview-territory-symbol" aria-hidden="true"><MapPin size={27}/><span/><span/><span/></div>
      <Link href="/mapa">Abrir mapa territorial <ArrowRight size={17}/></Link>
     </section>
     <section className="overview-finance">
      <div className="overview-finance-title"><span className="overview-finance-icon"><Wallet size={21}/></span><span>REEMBOLSOS</span></div>
      <strong>{data?currency(data.approved_expenses):'—'}</strong>
      <p>Valor somado das despesas marcadas como aprovadas ou pagas. Não representa exclusivamente pagamentos efetuados.</p>
      {admin&&<Link href="/reembolsos">Consultar reembolsos <ArrowRight size={16}/></Link>}
     </section>
    </div>
   </div>
   <section className="overview-shortcuts" aria-labelledby="overview-shortcuts-title">
    <div><span className="overview-kicker">ACESSOS RÁPIDOS</span><h2 id="overview-shortcuts-title">Continue o trabalho</h2></div>
    <div className="overview-shortcut-links">
     <Link href="/empresas"><Building2 size={18}/> Empresas <ArrowUpRight size={16}/></Link>
     <Link href="/relatorios"><ClipboardCheck size={18}/> Relatórios <ArrowUpRight size={16}/></Link>
     {admin&&<Link href="/equipes"><Users size={18}/> Equipe <ArrowUpRight size={16}/></Link>}
     <Link href="/configuracoes"><ShieldCheck size={18}/> Configurações <ArrowUpRight size={16}/></Link>
    </div>
   </section>
  </div>
 </Portal>;
}
