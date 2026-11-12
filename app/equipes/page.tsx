'use client';
import {useCallback,useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {CheckCircle2,Clock3,ShieldCheck,UserCheck,UsersRound,XCircle} from 'lucide-react';

type Role='admin'|'supervisor'|'agent'|'cadastro'|'rh';
type Request={id:string;auth_user_id:string;email:string;full_name:string;status:'pending'|'approved'|'rejected';assigned_role:Role|null;email_verified:boolean;created_at:string};
type VerifiedAccount={auth_user_id:string;full_name:string;email:string};
type Profile={auth_user_id:string;full_name:string;email:string|null;role:Role;is_active:boolean};
const labels:Record<Role,string>={admin:'Administrador',supervisor:'Supervisor',agent:'Agente de campo',cadastro:'Cadastro sindical',rh:'Recursos Humanos'};
export default function Equipes(){
 const [requests,setRequests]=useState<Request[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[verifiedWithoutRequest,setVerifiedWithoutRequest]=useState<VerifiedAccount[]>([]);
 const [readiness,setReadiness]=useState<{cadastro:boolean;rh:boolean}|null>(null);
 const [loading,setLoading]=useState(true),[denied,setDenied]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [roles,setRoles]=useState<Record<string,Role>>({});
 const [profileRoles,setProfileRoles]=useState<Record<string,Role>>({});
 const load=useCallback(async()=>{
  try{
   const r=await fetch('/api/access-requests',{cache:'no-store'});
   if(r.status===401||r.status===403){setDenied(true);return;}
   const json=await r.json();if(!r.ok)throw new Error(json.error||'Falha ao consultar solicitações.');
   if(!('requests' in json)){setDenied(true);return;}
   setRequests(json.requests||[]);setProfiles(json.profiles||[]);setVerifiedWithoutRequest(json.verifiedWithoutRequest||[]);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar equipes.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();
  fetch('/api/admin/prontidao',{cache:'no-store'}).then(async r=>{if(!r.ok)return null;return r.json()})
   .then(d=>{if(!d)return;const checks=d.checks||[];setReadiness({cadastro:Boolean(checks[0]?.ready),rh:Boolean(checks[1]?.ready)})})
   .catch(()=>{});
 },[load]);
 async function decide(request:Request, action:'approve'|'reject'){
  const role=roles[request.id]||'agent';
  const prompt=action==='approve'?`Aprovar ${request.full_name} como ${labels[role]}?`:`Recusar a solicitação de ${request.full_name}?`;
  if(!window.confirm(prompt))return;
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
  if(!window.confirm('Alterar o cargo de '+profile.full_name+' para '+labels[nextRole]+'? O acesso será atualizado após a nova consulta ao servidor.'))return;
  setBusy(profile.auth_user_id);setError('');setMessage('');
  try{
   const r=await fetch('/api/access-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'change-role',profile_id:profile.auth_user_id,role:nextRole})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível alterar o cargo.');
   setMessage('Cargo atualizado para '+labels[nextRole]+'.');setProfileRoles(prev=>({...prev,[profile.auth_user_id]:nextRole}));
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar o cargo.')}
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
 return <Portal title="Pessoas & Acessos" subtitle="Analise novos cadastros e defina quem pode utilizar a plataforma.">
  {loading?<section className="panel"><p className="muted">Carregando solicitações...</p></section>:denied?<section className="panel"><h2>Acesso reservado à administração</h2><p className="muted">Somente administradores podem aprovar novas contas.</p></section>:<>
   <div className="cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))'}}>
    <div className="card"><div className="metric-top"><span className="label">Aguardando aprovação</span><span className="metric-icon orange"><Clock3 size={19}/></span></div><strong>{pending.length}</strong><em>Solicitações para analisar</em></div>
    <div className="card"><div className="metric-top"><span className="label">Pessoas autorizadas</span><span className="metric-icon"><UsersRound size={19}/></span></div><strong>{profiles.filter(p=>p.is_active).length}</strong><em>Perfis com acesso ativo</em></div>
   </div>
   {readiness&&(!readiness.cadastro||!readiness.rh)&&<section className="panel" role="status" style={{marginBottom:20,borderColor:'#e6ae7b'}}>
    <div className="panel-title"><div><small>PREPARAÇÃO DO NEON</small><h2>Cargos novos aguardam migração</h2></div><ShieldCheck size={23}/></div>
    <p>Os e-mails podem estar verificados, mas a aprovação dos perfis Cadastro e RH exige as migrações 008 e 009 no mesmo banco conectado a este ambiente. Nenhuma conta será promovida automaticamente.</p>
    <p className="muted">Cadastro: {readiness.cadastro?'pronto':'pendente'} · RH: {readiness.rh?'pronto':'pendente'}. O administrador deve validar a estrutura do banco antes de liberar os cargos.</p>
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
       <select aria-label={`Perfil para ${r.full_name}`} className="field" value={roles[r.id]||'agent'} onChange={e=>setRoles(p=>({...p,[r.id]:e.target.value as Role}))}>
        <option value="agent">Agente de campo</option><option value="cadastro">Cadastro sindical</option><option value="rh">Recursos Humanos</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option>
       </select>
       <button className="button"
        disabled={busy!==null||!r.email_verified||(roles[r.id]||'agent')==='cadastro'&&readiness?.cadastro===false||(roles[r.id]||'agent')==='rh'&&readiness?.rh===false}
        title={!r.email_verified?'Verifique o e-mail no Neon Auth deste ambiente.':'O cargo depende da migração correspondente no Neon.'}
        onClick={()=>void decide(r,'approve')}><UserCheck size={16}/> Aprovar</button>
       <button className="button secondary" disabled={busy!==null} onClick={()=>void decide(r,'reject')}><XCircle size={16}/> Recusar</button>
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
    <div className="tablewrap"><table><thead><tr><th>Pessoa</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Alterar cargo</th></tr></thead><tbody>{profiles.map(p=><tr key={p.auth_user_id}><td><strong>{p.full_name}</strong></td><td>{p.email||'—'}</td><td>{labels[p.role]}</td><td><span className={p.is_active?'pill':'pill warn'}>{p.is_active?'Ativo':'Inativo'}</span></td><td>
     {p.role==='admin'?<span className="muted">Gerenciado pela administração</span>:
     <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
      <select className="field" style={{minWidth:155}} aria-label={'Novo cargo de '+p.full_name}
       value={profileRoles[p.auth_user_id]||p.role}
       onChange={e=>setProfileRoles(old=>({...old,[p.auth_user_id]:e.target.value as Role}))}>
       <option value="agent">Agente de campo</option><option value="supervisor">Supervisor</option><option value="cadastro">Cadastro sindical</option><option value="rh">Recursos Humanos</option>
      </select>
      <button type="button" className="button secondary" disabled={busy!==null||!p.is_active||(profileRoles[p.auth_user_id]||p.role)===p.role}
       onClick={()=>void changeProfileRole(p)}>Salvar</button>
     </div>}</td></tr>)}{profiles.length===0&&<tr><td colSpan={5}>Nenhum perfil aprovado.</td></tr>}</tbody></table></div>
   </section>
   {message&&<p className="success" role="status" style={{marginTop:18}}>{message}</p>}
   {error&&<p className="error" role="alert" style={{marginTop:18}}>{error}</p>}
  </>}
 </Portal>;
}
