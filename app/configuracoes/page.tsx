'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Portal} from '@/components/portal';
import {StudioPageBanner} from '@/components/studio-page-banner';
import {ArrowRight,CheckCircle2,Database,ShieldAlert,Users} from 'lucide-react';

type Cfg={profile:{name:string;email:string;role:string};administrator:boolean;company_count?:number;auth_provider?:string};
type Check={label:string;ready:boolean};
const roleNames:Record<string,string>={admin:'Administrador',supervisor:'Supervisor',agent:'Agente de campo',cadastro:'Cadastro sindical',rh:'Recursos Humanos'};
export default function Configuracoes(){
 const [data,setData]=useState<Cfg|null>(null),[error,setError]=useState(''),[checks,setChecks]=useState<Check[]|null>(null);
 const [environment,setEnvironment]=useState<'production'|'preview'|'development'|null>(null);
 const [diagnosticError,setDiagnosticError]=useState(false);
 useEffect(()=>{
  let live=true;
  fetch('/api/configuracoes',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar perfil.');return d})
   .then(d=>{if(live)setData(d);if(d.administrator){
    fetch('/api/admin/prontidao',{cache:'no-store'}).then(async r=>{
     if(!r.ok)throw Error('Diagnóstico indisponível.');
     return r.json();
    }).then(p=>{if(live){setChecks(p.checks||[]);setEnvironment(p.environment||'development')}})
     .catch(()=>{if(live)setDiagnosticError(true)});
   }}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Dados indisponíveis.')});
  return()=>{live=false};
 },[]);
 return <Portal title={data?.administrator?'Configurações e acesso':'Meu perfil'} subtitle="Identidade, permissões e preparação dos recursos da plataforma.">
  <StudioPageBanner eyebrow="CONTA & SEGURANÇA" title="Seu espaço, suas permissões." description="Consulte seus dados e as condições de acesso à plataforma." icon={Database}/>
  {error&&<p className="error" role="alert">{error}</p>}
  <section className="panel" style={{marginBottom:18}}>
   <div className="panel-title"><div><small>IDENTIFICAÇÃO</small><h2>Sua conta</h2></div></div>
   <div className="studio-profile-identity">
    <span className="studio-profile-avatar" aria-hidden="true">{data?.profile.name?.charAt(0).toUpperCase()||'—'}</span>
    <div><strong>{data?.profile.name||'Carregando perfil...'}</strong><small>{data?.profile.email||'E-mail não disponível'}</small><span className="pill">{roleNames[data?.profile.role||'']||data?.profile.role||'Cargo indisponível'}</span></div>
   </div>
   <p className="muted">As permissões são definidas pela administração. A recuperação de senha utiliza o fluxo seguro de autenticação.</p>
  </section>
  {data?.administrator&&<>
   <section className="panel" style={{marginBottom:18}}>
    <div className="panel-title"><div><small>PREPARAÇÃO DO SISTEMA</small><h2>Banco de dados e novos cargos</h2></div><Database size={24} color="#d46d24"/></div>
    <p className="muted">Diagnóstico do Neon conectado a este ambiente. Esta página não altera o banco.{' '}
     <strong>Ambiente: {environment==='production'?'Produção':environment==='preview'?'Preview / Testes':environment==='development'?'Desenvolvimento':'Identificando...'}</strong></p>
    <div style={{display:'grid',gap:9,marginTop:13}}>
     {checks?.map(check=><div key={check.label} style={{display:'flex',alignItems:'center',gap:10,padding:13,border:'1px solid #e6ebe4',borderRadius:11}}>
      {check.ready?<CheckCircle2 color="#278451" size={19}/>:<ShieldAlert color="#cc7829" size={19}/>}
      <span style={{fontSize:13,fontWeight:750,flex:1}}>{check.label}</span>
      <span style={{fontSize:12,color:check.ready?'#278451':'#a45c23',fontWeight:800}}>{check.ready?'Pronto':'Pendente'}</span>
     </div>)}
     {!checks&&!diagnosticError&&<p className="muted" role="status">Consultando a estrutura do banco...</p>}
     {diagnosticError&&<p className="error" role="alert">Não foi possível consultar o diagnóstico. Atualize a página para verificar o Neon.</p>}
    </div>
    {checks?.some(c=>!c.ready)&&<p style={{fontSize:13,color:'#82603d',marginTop:13,lineHeight:1.55}} role="alert">
     {environment==='production'
      ?'A produção está sem a estrutura necessária. Cadastro e RH permanecem indisponíveis. Homologue primeiro no Preview; depois obtenha autorização, prepare backup de produção e aplique as migrações 008 e 009 em ordem, validando o resultado antes de liberar essas funções.'
      :'Este ambiente ainda não está preparado. Após backup da branch de testes correta e autorização, aplique as migrações 008 e 009 em ordem e confira novamente. Não utilize a branch principal para homologação.'}
    </p>}
    {checks?.length===2&&checks.every(c=>c.ready)&&<p role="status" style={{fontSize:13,color:'#246d48',marginTop:13,lineHeight:1.55}}>
     Estrutura do banco compatível. Os acessos e os fluxos de Cadastro e RH ainda precisam de homologação funcional com usuários autorizados.
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
