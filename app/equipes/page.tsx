'use client';
import {useCallback,useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {CheckCircle2,Clock3,ShieldCheck,UserCheck,UsersRound,XCircle,Info,ExternalLink} from 'lucide-react';
import {getRoleReadinessStatus} from '@/lib/role-editor';
import './equipes.css';

type Role='admin'|'supervisor'|'agent'|'cadastro'|'rh';
type Request={id:string;auth_user_id:string;email:string;full_name:string;status:'pending'|'approved'|'rejected';assigned_role:Role|null;email_verified:boolean;created_at:string};
type VerifiedAccount={auth_user_id:string;full_name:string;email:string};
type Profile={auth_user_id:string;full_name:string;email:string|null;role:Role;is_active:boolean};
const labels:Record<Role,string>={admin:'Administrador',supervisor:'Supervisor',agent:'Agente de campo',cadastro:'Cadastro sindical',rh:'Recursos Humanos'};
export default function Equipes(){
 const [requests,setRequests]=useState<Request[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[verifiedWithoutRequest,setVerifiedWithoutRequest]=useState<VerifiedAccount[]>([]);
 const [readiness,setReadiness]=useState<{cadastro:boolean;rh:boolean;environment:'production'|'preview'|'development'}|null>(null);
 const [readinessError,setReadinessError]=useState(false);
 const [loading,setLoading]=useState(true),[denied,setDenied]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [roles,setRoles]=useState<Record<string,Role>>({});
 const [profileRoles,setProfileRoles]=useState<Record<string,Role>>({});
 const [roleIssues,setRoleIssues]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  try{
   const r=await fetch('/api/access-requests',{cache:'no-store'});
   if(r.status===401||r.status===403){setDenied(true);return;}
   const json=await r.json();if(!r.ok)throw new Error(json.error||'Falha ao consultar solicitações.');
   if(!('requests' in json)){setDenied(true);return;}
   setRequests(json.requests||[]);setProfiles(json.profiles||[]);setVerifiedWithoutRequest(json.verifiedWithoutRequest||[]);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar equipes.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();
  fetch('/api/admin/prontidao',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Diagnóstico indisponível.');return r.json()})
   .then(d=>{const checks=d.checks||[];setReadiness({cadastro:Boolean(checks[0]?.ready),rh:Boolean(checks[1]?.ready),environment:d.environment||'development'});setReadinessError(false)})
   .catch(()=>setReadinessError(true));
 },[load]);
 async function decide(request:Request, action:'approve'|'reject'){
  const role=roles[request.id]||'agent';
  const prompt=action==='approve'?`Aprovar ${request.full_name} como ${labels[role]}?`:`Recusar a solicitação de ${request.full_name}?`;
  if(action==='approve'&&!roleAvailable(role)){
   setRoleIssues(p=>({...p,[request.id]:roleHelp(role)}));return;
  }
  if(!window.confirm(prompt))return;
  setRoleIssues(p=>({...p,[request.id]:''}));
  setBusy(request.id);setMessage('');setError('');
  try{
   const r=await fetch('/api/access-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:request.id,action,role})});
   const json=await r.json();if(!r.ok)throw new Error(json.error||'Falha na avaliação.');
   setMessage(action==='approve'?'Acesso aprovado. O usuário poderá entrar no sistema.':'Solicitação recusada.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao analisar solicitação.');}
  finally{setBusy(null);}
 }
 async function changeProfileRole(profile:Profile){
  const nextRole=profileRoles[profile.auth_user_id]||profile.role;
  if(nextRole===profile.role)return;
  if(!roleAvailable(nextRole)){
   setRoleIssues(p=>({...p,[profile.auth_user_id]:roleHelp(nextRole)}));return;
  }
  if(!window.confirm('Alterar o cargo de '+profile.full_name+' para '+labels[nextRole]+'? O acesso será atualizado após a nova consulta ao servidor.'))return;
  setBusy(profile.auth_user_id);setError('');setMessage('');setRoleIssues(p=>({...p,[profile.auth_user_id]:''}));
  try{
   const r=await fetch('/api/access-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'change-role',profile_id:profile.auth_user_id,role:nextRole})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível alterar o cargo.');
   setMessage('Cargo atualizado para '+labels[nextRole]+'.');
   setProfiles(prev=>prev.map(p=>p.auth_user_id===profile.auth_user_id?{...p,role:nextRole}:p));
   setProfileRoles(prev=>{const updated={...prev};delete updated[profile.auth_user_id];return updated});
   await load();
  }catch(e){const msg=e instanceof Error?e.message:'Não foi possível alterar o cargo.';setError(msg);setRoleIssues(p=>({...p,[profile.auth_user_id]:msg}))}
  finally{setBusy(null)}
 }
 async function queueVerified(account:VerifiedAccount){
  if(!window.confirm('Adicionar '+account.email+' à fila de aprovação, sem conceder acesso agora?'))return;
  setBusy(account.auth_user_id);setError('');setMessage('');
  try{
   const r=await fetch('/api/access-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'queue-verified',auth_user_id:account.auth_user_id})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao adicionar à fila.');
   await load();setMessage('Conta verificada adicionada à fila. Escolha o cargo e aprove o acesso separadamente.');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao adicionar conta.')}
  finally{setBusy(null)}
 }
 const pending=requests.filter(r=>r.status==='pending');
 const roleStatus=(role:Role)=>getRoleReadinessStatus(role,readiness,readinessError);
 const roleAvailable=(role:Role)=>roleStatus(role)==='ready';
 const roleHelp=(role:Role)=>{
  if(roleStatus(role)==='loading')return 'Consultando o Neon. Aguarde a verificação antes de salvar este cargo.';
  if(readinessError)return 'Não foi possível verificar o banco conectado. Atualize a página e tente novamente.';
  const name=role==='rh'?'009 (RH e reembolsos)':'008 (Cadastro sindical)';
  return readiness?.environment==='production'
   ?`A migração ${name} ainda não está aplicada na produção. Use o QA para homologar; a alteração real deste cargo só poderá ocorrer após migração autorizada.`
   :`A migração ${name} não está pronta neste banco. Verifique a preparação do Neon antes de salvar.`;
 };
 const qaPreview='https://gest-o-de-campo-sind-git-fix-cadastro-busca-cnpj-375062-seeven.vercel.app';
 return <Portal title="Pessoas & Acessos" subtitle="Analise novos cadastros e defina quem pode utilizar a plataforma.">
  {loading?<section className="panel"><p className="muted">Carregando solicitações...</p></section>:denied?<section className="panel"><h2>Acesso reservado à administração</h2><p className="muted">Somente administradores podem aprovar novas contas.</p></section>:<>
   <div className="cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))'}}>
    <div className="card"><div className="metric-top"><span className="label">Aguardando aprovação</span><span className="metric-icon orange"><Clock3 size={19}/></span></div><strong>{pending.length}</strong><em>Solicitações para analisar</em></div>
    <div className="card"><div className="metric-top"><span className="label">Pessoas autorizadas</span><span className="metric-icon"><UsersRound size={19}/></span></div><strong>{profiles.filter(p=>p.is_active).length}</strong><em>Perfis com acesso ativo</em></div>
   </div>
   {readinessError&&<section className="panel" role="alert" style={{marginBottom:20,borderColor:'#e6ae7b'}}>
    <strong>Não foi possível verificar a preparação do Neon.</strong>
    <p className="muted">Você pode selecionar um cargo, mas o salvamento de Cadastro e RH só será permitido após confirmar a estrutura do banco. Atualize a página para tentar novamente.</p>
   </section>}
   {readiness&&(!readiness.cadastro||!readiness.rh)&&<section className="panel" role="status" style={{marginBottom:20,borderColor:'#e6ae7b'}}>
    <div className="panel-title"><div><small>PREPARAÇÃO DO NEON · {readiness.environment==='production'?'PRODUÇÃO':readiness.environment==='preview'?'PREVIEW':'DESENVOLVIMENTO'}</small><h2>Cargos novos indisponíveis neste ambiente</h2></div><ShieldCheck size={23}/></div>
    <p>Este banco ainda não tem toda a estrutura necessária. Você pode selecionar o cargo para consultar sua disponibilidade; o salvamento permanece protegido até a migração. Nenhuma conta será promovida automaticamente.</p>
    <p className="muted">Cadastro: {readiness.cadastro?'pronto':'pendente'} · RH: {readiness.rh?'pronto':'pendente'}. Ao escolher um cargo pendente, a tela explica como prosseguir e indica o ambiente de testes.</p>
    {readiness.environment==='production'&&<div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,marginTop:16}}>
     <a className="button secondary" href={qaPreview} target="_blank" rel="noopener noreferrer">Abrir ambiente de testes (QA)</a>
     <small className="muted" style={{maxWidth:580}}>O QA já possui as migrações. Os perfis criados exclusivamente na produção, como RH1, não aparecem automaticamente no QA. Use ou cadastre uma conta de teste nesse ambiente e aprove-a por um administrador.</small>
    </div>}
   </section>}
   {readiness?.environment==='preview'&&readiness.cadastro&&readiness.rh&&<section className="panel" role="status" style={{marginBottom:20,borderColor:'#b7ddc6'}}>
    <div className="panel-title"><div><small>NEON QA · PREVIEW</small><h2>Cadastro e RH disponíveis para homologação</h2></div><ShieldCheck size={23}/></div>
    <p className="muted">Estrutura de testes pronta. Escolha abaixo um perfil de teste autorizado, altere o cargo e salve. Nenhum usuário da produção será modificado por esta operação.</p>
   </section>}
   <section className="panel" style={{marginBottom:20}}>
    <div className="panel-title"><div><small>ANÁLISE ADMINISTRATIVA</small><h2>Novas solicitações</h2></div><ShieldCheck color="#38845d" size={24}/></div>
    <p className="muted">Cada pessoa cria a própria conta na tela de acesso. Aqui a administração confirma quem é, verifica a situação e escolhe o perfil. Cadastros sem aprovação não acessam empresas, rotas ou dados internos. O perfil Cadastro confirma empresas na base sindical após a validação da supervisão.</p>
    {pending.length===0?<div className="empty"><div><CheckCircle2 size={30} color="#4d8e67"/><strong>Nenhuma solicitação pendente</strong><p>Novos cadastros aparecerão nesta seção para análise.</p></div></div>:<div style={{display:'grid',gap:12,marginTop:20}}>
     {pending.map(r=><div key={r.id} style={{padding:18,border:'1px solid var(--line)',borderRadius:14,display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',justifyContent:'space-between'}}>
      <div style={{minWidth:220,flex:1}}><strong style={{fontSize:15}}>{r.full_name}</strong><p className="muted" style={{margin:'5px 0'}}>{r.email}</p><span className="pill warn">Aguardando desde {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
       <span style={{display:'block',marginTop:6,fontSize:12,color:r.email_verified?'#26704d':'#b45328'}}>
        {r.email_verified?'E-mail verificado neste Neon':'E-mail não verificado neste Neon'}
       </span></div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
       <select aria-label={`Perfil para ${r.full_name}`} className="field" value={roles[r.id]||'agent'} onChange={e=>{setRoles(p=>({...p,[r.id]:e.target.value as Role}));setRoleIssues(p=>({...p,[r.id]:''}))}}>
        <option value="agent">Agente de campo</option><option value="cadastro">Cadastro sindical</option><option value="rh">Recursos Humanos</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option>
       </select>
       <button className="button"
        disabled={busy!==null||!r.email_verified}
        title={!r.email_verified?'Verifique o e-mail no Neon Auth deste ambiente.':'Verificar e aprovar o cargo selecionado.'}
        onClick={()=>void decide(r,'approve')}><UserCheck size={16}/> Aprovar</button>
       <button className="button secondary" disabled={busy!==null} onClick={()=>void decide(r,'reject')}><XCircle size={16}/> Recusar</button>
       {((!roleAvailable(roles[r.id]||'agent')||roleIssues[r.id])&&(roles[r.id]||'agent')!=='admin')&&<p className="staff-role-help" role="status"><Info size={17} aria-hidden="true"/><span>{roleIssues[r.id]||roleHelp(roles[r.id]||'agent')}</span>{readiness?.environment==='production'&&<a href={qaPreview} target="_blank" rel="noopener noreferrer">Abrir QA <ExternalLink size={14}/></a>}</p>}
      </div>
     </div>)}
    </div>}
   </section>
   {verifiedWithoutRequest.length>0&&<section className="panel" style={{marginBottom:20}}>
    <div className="panel-title"><div><small>CONTAS JÁ VERIFICADAS</small><h2>Ainda não solicitaram acesso</h2></div><UsersRound size={22}/></div>
    <p className="muted">Estas contas têm e-mail verificado neste Neon, mas não estão na fila. Enviá-las à fila não libera o acesso. Contas criadas em outra branch do Neon não aparecem aqui.</p>
    <div style={{display:'grid',gap:10}}>
     {verifiedWithoutRequest.map(account=><div key={account.auth_user_id} style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:12,padding:12,border:'1px solid var(--line)',borderRadius:12}}>
      <div style={{flex:1,minWidth:180}}><strong>{account.full_name}</strong><small style={{display:'block',marginTop:4}}>{account.email}</small></div>
      <button type="button" className="button secondary" disabled={busy!==null} onClick={()=>void queueVerified(account)}>Adicionar à fila</button>
     </div>)}
    </div>
   </section>}
   <section className="panel"><div className="panel-title"><div><small>ACESSOS ATIVOS</small><h2>Equipe cadastrada</h2></div><UsersRound size={22} color="#648a76"/></div>
    <div className="tablewrap staff-tablewrap"><table className="staff-table"><thead><tr><th>Pessoa</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Alterar cargo</th></tr></thead><tbody>{profiles.map(p=><tr key={p.auth_user_id}><td data-label="Pessoa"><strong>{p.full_name}</strong></td><td data-label="E-mail">{p.email||'—'}</td><td data-label="Perfil atual">{labels[p.role]}</td><td data-label="Situação"><span className={p.is_active?'pill':'pill warn'}>{p.is_active?'Ativo':'Inativo'}</span></td><td data-label="Alterar cargo" className="staff-editor-cell">
     {p.role==='admin'?<span className="muted">Gerenciado pela administração</span>:
     <div className="staff-role-editor">
     <div className="staff-role-controls">
      <select className="field staff-role-select" aria-label={'Novo cargo de '+p.full_name}
       value={profileRoles[p.auth_user_id]||p.role}
       onChange={e=>{setProfileRoles(old=>({...old,[p.auth_user_id]:e.target.value as Role}));setRoleIssues(old=>({...old,[p.auth_user_id]:''}))}}>
       <option value="agent">Agente de campo</option><option value="supervisor">Supervisor</option><option value="cadastro">Cadastro sindical</option><option value="rh">Recursos Humanos</option>
      </select>
      <button type="button" className="button secondary staff-role-save" disabled={busy!==null||!p.is_active||(profileRoles[p.auth_user_id]||p.role)===p.role}
       onClick={()=>void changeProfileRole(p)}>{busy===p.auth_user_id?'Salvando...':'Salvar'}</button>
     </div>
     {((profileRoles[p.auth_user_id]||p.role)!==p.role&&!roleAvailable(profileRoles[p.auth_user_id]||p.role)||roleIssues[p.auth_user_id])&&
      <p className="staff-role-help" role="status"><Info size={17} aria-hidden="true"/><span>{roleIssues[p.auth_user_id]||roleHelp(profileRoles[p.auth_user_id]||p.role)}</span>
       {readiness?.environment==='production'&&<a href={qaPreview} target="_blank" rel="noopener noreferrer">Abrir QA <ExternalLink size={14}/></a>}
      </p>}
     </div>}</td></tr>)}{profiles.length===0&&<tr><td colSpan={5}>Nenhum perfil aprovado.</td></tr>}</tbody></table></div>
   </section>
   {message&&<p className="success" role="status" style={{marginTop:18}}>{message}</p>}
   {error&&<p className="error" role="alert" style={{marginTop:18}}>{error}</p>}
  </>}
 </Portal>;
}
