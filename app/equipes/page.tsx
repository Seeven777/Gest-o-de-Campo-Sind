'use client';
import {useCallback,useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {CheckCircle2,Clock3,ShieldCheck,UserCheck,UsersRound,XCircle} from 'lucide-react';

type Role='admin'|'supervisor'|'agent'|'cadastro';
type Request={id:string;auth_user_id:string;email:string;full_name:string;status:'pending'|'approved'|'rejected';assigned_role:Role|null;created_at:string};
type Profile={auth_user_id:string;full_name:string;email:string|null;role:Role;is_active:boolean};
const labels:Record<Role,string>={admin:'Administrador',supervisor:'Supervisor',agent:'Agente de campo',cadastro:'Cadastro sindical'};
export default function Equipes(){
 const [requests,setRequests]=useState<Request[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
 const [loading,setLoading]=useState(true),[denied,setDenied]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [roles,setRoles]=useState<Record<string,Role>>({});
 const load=useCallback(async()=>{
  try{
   const r=await fetch('/api/access-requests',{cache:'no-store'});
   if(r.status===401||r.status===403){setDenied(true);return;}
   const json=await r.json();if(!r.ok)throw new Error(json.error||'Falha ao consultar solicitações.');
   if(!('requests' in json)){setDenied(true);return;}
   setRequests(json.requests||[]);setProfiles(json.profiles||[]);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar equipes.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
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
 const pending=requests.filter(r=>r.status==='pending');
 return <Portal title="Pessoas & Acessos" subtitle="Analise novos cadastros e defina quem pode utilizar a plataforma.">
  {loading?<section className="panel"><p className="muted">Carregando solicitações...</p></section>:denied?<section className="panel"><h2>Acesso reservado à administração</h2><p className="muted">Somente administradores podem aprovar novas contas.</p></section>:<>
   <div className="cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))'}}>
    <div className="card"><div className="metric-top"><span className="label">Aguardando aprovação</span><span className="metric-icon orange"><Clock3 size={19}/></span></div><strong>{pending.length}</strong><em>Solicitações para analisar</em></div>
    <div className="card"><div className="metric-top"><span className="label">Pessoas autorizadas</span><span className="metric-icon"><UsersRound size={19}/></span></div><strong>{profiles.filter(p=>p.is_active).length}</strong><em>Perfis com acesso ativo</em></div>
   </div>
   <section className="panel" style={{marginBottom:20}}>
    <div className="panel-title"><div><small>ANÁLISE ADMINISTRATIVA</small><h2>Novas solicitações</h2></div><ShieldCheck color="#38845d" size={24}/></div>
    <p className="muted">Cada pessoa cria a própria conta na tela de acesso. Aqui a administração confirma quem é, verifica a situação e escolhe o perfil. Cadastros sem aprovação não acessam empresas, campanhas ou dados internos.</p>
    {pending.length===0?<div className="empty"><div><CheckCircle2 size={30} color="#4d8e67"/><strong>Nenhuma solicitação pendente</strong><p>Novos cadastros aparecerão nesta seção para análise.</p></div></div>:<div style={{display:'grid',gap:12,marginTop:20}}>
     {pending.map(r=><div key={r.id} style={{padding:18,border:'1px solid var(--line)',borderRadius:14,display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',justifyContent:'space-between'}}>
      <div style={{minWidth:220,flex:1}}><strong style={{fontSize:15}}>{r.full_name}</strong><p className="muted" style={{margin:'5px 0'}}>{r.email}</p><span className="pill warn">Aguardando desde {new Date(r.created_at).toLocaleDateString('pt-BR')}</span></div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
       <select aria-label={`Perfil para ${r.full_name}`} className="field" value={roles[r.id]||'agent'} onChange={e=>setRoles(p=>({...p,[r.id]:e.target.value as Role}))}>
        <option value="agent">Agente de campo</option><option value="cadastro">Cadastro sindical</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option>
       </select>
       <button className="button" disabled={busy!==null} onClick={()=>void decide(r,'approve')}><UserCheck size={16}/> Aprovar</button>
       <button className="button secondary" disabled={busy!==null} onClick={()=>void decide(r,'reject')}><XCircle size={16}/> Recusar</button>
      </div>
     </div>)}
    </div>}
   </section>
   <section className="panel"><div className="panel-title"><div><small>ACESSOS ATIVOS</small><h2>Equipe cadastrada</h2></div><UsersRound size={22} color="#648a76"/></div>
    <div className="tablewrap"><table><thead><tr><th>Pessoa</th><th>E-mail</th><th>Perfil</th><th>Situação</th></tr></thead><tbody>{profiles.map(p=><tr key={p.auth_user_id}><td><strong>{p.full_name}</strong></td><td>{p.email||'—'}</td><td>{labels[p.role]}</td><td><span className={p.is_active?'pill':'pill warn'}>{p.is_active?'Ativo':'Inativo'}</span></td></tr>)}{profiles.length===0&&<tr><td colSpan={4}>Nenhum perfil aprovado.</td></tr>}</tbody></table></div>
   </section>
   {message&&<p className="success" role="status" style={{marginTop:18}}>{message}</p>}
   {error&&<p className="error" role="alert" style={{marginTop:18}}>{error}</p>}
  </>}
 </Portal>;
}
