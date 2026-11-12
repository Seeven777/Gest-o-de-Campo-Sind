'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Building2,CheckCheck,Map,MapPin,Route,ShieldCheck,Users,Wallet} from 'lucide-react';
import {Portal} from '@/components/portal';
import './overview.css';

type Totals={establishments:number;routes:number;visits:number;validated:number;registrations:number|null;approved_expenses:number};
type Check={label:string;ready:boolean};
const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');
const currency=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function Dashboard(){
 const [data,setData]=useState<Totals|null>(null);
 const [error,setError]=useState(''),[registrationReady,setRegistrationReady]=useState(false);
 const [checks,setChecks]=useState<Check[]|null>(null),[admin,setAdmin]=useState(false);
 useEffect(()=>{
  let active=true;
  fetch('/api/overview',{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao consultar indicadores.');return d})
   .then(d=>{if(active){setData(d.totals);setRegistrationReady(Boolean(d.registration_ready))}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Dados indisponíveis.')});
  fetch('/api/me',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
   .then(d=>{if(!active||d?.user?.role!=='admin')return;setAdmin(true);
    return fetch('/api/admin/prontidao',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
     .then(p=>{if(active&&p?.checks)setChecks(p.checks)});
   }).catch(()=>{});
  return()=>{active=false};
 },[]);
 const cards=[
  {title:'Empresas na base',value:data?.establishments,icon:Building2,sub:'Base operacional'},
  {title:'Visitas realizadas',value:data?.visits,icon:MapPin,sub:'Histórico de campo'},
  {title:'Validadas em campo',value:data?.validated,icon:CheckCheck,sub:'Conferidas pela supervisão'},
  {title:'Cadastros confirmados',value:data?.registrations,icon:ShieldCheck,sub:registrationReady?'Conferidos na base sindical':'Aguardando configuração do cadastro'},
 ];
 const pending=checks?.filter(c=>!c.ready)||[];
 return <Portal title="Visão geral" subtitle="Empresas, visitas e resultados em um só lugar.">
  <section className="overview-toolbar">
   <div><span className="overview-eyebrow">CENTRAL OPERACIONAL</span><h2>O que precisa de atenção?</h2><p>Comece pelas rotas, acompanhe as visitas e confira o resultado da captação.</p></div>
   <Link className="overview-primary" href="/rotas"><Route size={19}/> Abrir rotas <ArrowRight size={17}/></Link>
  </section>
  {admin&&pending.length>0&&<div className="overview-setup" role="status">
   <span><ShieldCheck size={18}/><strong>Configuração de Cadastro e RH pendente</strong></span>
   <p>As métricas de campo continuam disponíveis. A confirmação sindical e os reembolsos exigem homologar as migrações {pending.map(c=>c.label.includes('008')?'008':'009').join(' e ')} no Neon.</p>
   <Link href="/configuracoes">Consultar configurações <ArrowRight size={14}/></Link>
  </div>}
  {error&&<p className="error" role="alert">Não foi possível carregar os indicadores operacionais: {error}</p>}
  <div className="overview-metrics">
   {cards.map(({title,value,icon:Icon,sub})=><div className="overview-metric" key={title}>
    <div><span>{title}</span><Icon size={19} aria-hidden="true"/></div>
    <strong>{data?(value===null?'—':fmt(value??0)):'—'}</strong>
    <small>{sub}</small>
   </div>)}
  </div>
  <div className="overview-panels">
   <section className="panel overview-flow">
    <div className="panel-title"><div><small>FLUXO DE CAPTAÇÃO</small><h2>Do campo ao cadastro</h2></div></div>
    <div className="overview-steps">
     <Link href="/rotas"><span className="overview-step-number">1</span><span><strong>Campo</strong><small>Planejar e executar visitas</small></span><ArrowRight size={17}/></Link>
     <Link href="/validacoes"><span className="overview-step-number">2</span><span><strong>Validar</strong><small>Conferir informações recebidas</small></span><ArrowRight size={17}/></Link>
     <Link href="/cadastros"><span className="overview-step-number">3</span><span><strong>Cadastro</strong><small>Confirmar na base oficial</small></span><ArrowRight size={17}/></Link>
    </div>
    <Link className="overview-inline" href="/empresas"><Building2 size={17}/> Consultar empresas <ArrowRight size={15}/></Link>
   </section>
   <section className="panel overview-territory">
    <div className="panel-title"><div><small>INTELIGÊNCIA TERRITORIAL</small><h2>Cobertura dos 645 municípios</h2></div><Map size={24}/></div>
    <p>Visualize empresas por cidade, situação de campo e cadastros confirmados quando a etapa estiver habilitada.</p>
    <div className="overview-territory-fig"><span>Rotas registradas</span><strong>{data?fmt(data.routes):'—'}</strong></div>
    <Link className="overview-primary" href="/mapa">Abrir mapa de São Paulo <ArrowRight size={17}/></Link>
   </section>
  </div>
  <section className="overview-lower">
   <div><Wallet size={18}/><span>Despesas aprovadas ou informadas como pagas</span><strong>{data?currency(data.approved_expenses):'—'}</strong></div>
   {admin&&<Link href="/equipes"><Users size={17}/> Administrar equipe <ArrowRight size={15}/></Link>}
  </section>
 </Portal>;
}
