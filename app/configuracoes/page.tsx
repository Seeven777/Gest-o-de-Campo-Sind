'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Portal} from '@/components/portal';
import {ArrowRight,CheckCircle2,Database,ShieldAlert,Users} from 'lucide-react';

type Cfg={profile:{name:string;email:string;role:string};administrator:boolean;company_count?:number;auth_provider?:string};
type Check={label:string;ready:boolean};
const roleNames:Record<string,string>={admin:'Administrador',supervisor:'Supervisor',agent:'Agente de campo',cadastro:'Cadastro sindical',rh:'Recursos Humanos'};
export default function Configuracoes(){
 const [data,setData]=useState<Cfg|null>(null),[error,setError]=useState(''),[checks,setChecks]=useState<Check[]|null>(null);
 useEffect(()=>{
  let live=true;
  fetch('/api/configuracoes',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar perfil.');return d})
   .then(d=>{if(live)setData(d);if(d.administrator){
    fetch('/api/admin/prontidao',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
     .then(p=>{if(live&&p?.checks)setChecks(p.checks)}).catch(()=>{});
   }}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Dados indisponíveis.')});
  return()=>{live=false};
 },[]);
 return <Portal title={data?.administrator?'Configurações e acesso':'Meu perfil'} subtitle="Identidade, permissões e preparação dos recursos da plataforma.">
  {error&&<p className="error" role="alert">{error}</p>}
  <section className="panel" style={{marginBottom:18}}>
   <div className="panel-title"><div><small>IDENTIFICAÇÃO</small><h2>Sua conta</h2></div></div>
   <p><strong>Nome: </strong>{data?.profile.name||'Carregando...'}</p>
   <p><strong>E-mail: </strong>{data?.profile.email||'—'}</p>
   <p><strong>Cargo: </strong>{roleNames[data?.profile.role||'']||data?.profile.role||'—'}</p>
   <p className="muted">O acesso é atribuído pela administração. Para recuperar a senha, utilize o fluxo de autenticação.</p>
  </section>
  {data?.administrator&&<>
   <section className="panel" style={{marginBottom:18}}>
    <div className="panel-title"><div><small>PREPARAÇÃO DO SISTEMA</small><h2>Banco de dados e novos cargos</h2></div><Database size={24} color="#d46d24"/></div>
    <p className="muted">Diagnóstico do Neon conectado a este ambiente. Esta página não altera o banco.</p>
    <div style={{display:'grid',gap:9,marginTop:13}}>
     {checks?.map(check=><div key={check.label} style={{display:'flex',alignItems:'center',gap:10,padding:13,border:'1px solid #e6ebe4',borderRadius:11}}>
      {check.ready?<CheckCircle2 color="#278451" size={19}/>:<ShieldAlert color="#cc7829" size={19}/>}
      <span style={{fontSize:13,fontWeight:750,flex:1}}>{check.label}</span>
      <span style={{fontSize:12,color:check.ready?'#278451':'#a45c23',fontWeight:800}}>{check.ready?'Pronto':'Pendente'}</span>
     </div>)}
     {!checks&&<p className="muted">Consultando a estrutura do banco...</p>}
    </div>
    {checks?.some(c=>!c.ready)&&<p style={{fontSize:13,color:'#82603d',marginTop:13,lineHeight:1.55}}>
     Antes de habilitar Cadastro e RH: crie um ponto de recuperação no Neon Preview, aplique a migração 008 e depois a 009 no banco de testes, e confira novamente estes indicadores. Não aplique no banco principal sem homologação.
    </p>}
    <Link href="/equipes" className="link-inline"><Users size={16}/> Gerenciar usuários e permissões <ArrowRight size={15}/></Link>
   </section>
   <section className="panel">
    <div className="panel-title"><div><small>OPERAÇÃO</small><h2>Empresas e conferência sindical</h2></div></div>
    <p className="muted">Empresas na base operacional: <strong>{data.company_count??'—'}</strong></p>
    <p className="muted">A confirmação sindical deve ser realizada pela equipe de Cadastro após a validação das informações de campo.</p>
    <Link href="/cadastros" className="link-inline">Abrir conferência sindical <ArrowRight size={15}/></Link>
   </section>
  </>}
 </Portal>;
}
