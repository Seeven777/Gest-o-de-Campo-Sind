'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Portal } from '@/components/portal';
import { Check, ClipboardCopy, Link2, Mail, ShieldCheck, UserRoundPlus, UsersRound, XCircle } from 'lucide-react';

type Role = 'admin'|'supervisor'|'agent';
type Profile = {auth_user_id:string;full_name:string;role:Role;is_active:boolean;created_at:string};
type Invitation = {id:string;email:string;full_name:string;role:Role;created_at:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};
const labels:Record<Role,string> = {admin:'Administrador',supervisor:'Supervisor',agent:'Agente de campo'};
const pt = (date:string) => new Date(date).toLocaleDateString('pt-BR');

export default function Equipes(){
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [invites,setInvites]=useState<Invitation[]>([]);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<Role>('agent');
 const [busy,setBusy]=useState(false);
 const [link,setLink]=useState('');
 const [denied,setDenied]=useState(false);
 const load=useCallback(async()=>{
   try{
     const response=await fetch('/api/access-invitations',{cache:'no-store'});
     const body=await response.json();
     if(response.status===403 || response.status===401){setDenied(true);return;}
     if(!response.ok)throw new Error(body.error||'Falha ao consultar equipe.');
     setProfiles(body.profiles||[]);setInvites(body.invitations||[]);
   }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar equipe.');}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function invite(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setError('');setMessage('');setLink('');setBusy(true);
   try{
     const response=await fetch('/api/access-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:name,email,role})});
     const json=await response.json();
     if(!response.ok)throw new Error(json.error||'Falha ao criar convite.');
     setLink(json.invite_url);setMessage('Convite criado. Copie o link e envie diretamente à pessoa autorizada. Ele será exibido apenas agora.');
     setName('');setEmail('');setRole('agent');void load();
   }catch(e){setError(e instanceof Error?e.message:'Não foi possível criar convite.');}
   finally{setBusy(false);}
 }
 async function revoke(id:string){
   if(!window.confirm('Revogar este convite? O link deixará de funcionar.'))return;
   setBusy(true);setError('');setMessage('');
   try{
     const r=await fetch('/api/access-invitations',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
     const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível revogar.');
     setMessage('Convite revogado com sucesso.');void load();
   }catch(e){setError(e instanceof Error?e.message:'Não foi possível revogar.');}
   finally{setBusy(false);}
 }
 const pending=invites.filter(i=>!i.accepted_at&&!i.revoked_at&&new Date(i.expires_at)>new Date());
 return <Portal title="Pessoas & Acessos" subtitle="Convide as pessoas certas e controle quem pode trabalhar na plataforma.">
  {loading?<section className="panel"><p className="muted">Carregando perfis...</p></section>:
  denied?<section className="panel"><h2>Acesso reservado à administração</h2><p className="muted">Somente administradores podem criar convites ou consultar a gestão de usuários.</p></section>:<>
   <section className="cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))'}}>
    <div className="card"><div className="metric-top"><span className="label">Pessoas com acesso</span><span className="metric-icon"><UsersRound size={18}/></span></div><strong>{profiles.filter(p=>p.is_active).length}</strong><em>Perfis ativos e autorizados</em></div>
    <div className="card"><div className="metric-top"><span className="label">Convites aguardando aceite</span><span className="metric-icon orange"><Mail size={18}/></span></div><strong>{pending.length}</strong><em>Validade de 72 horas</em></div>
   </section>
   <div className="two-cols" style={{gridTemplateColumns:'minmax(280px,.88fr) minmax(350px,1.12fr)'}}>
    <section className="panel">
      <div className="panel-title"><div><small>ACESSO CONTROLADO</small><h2>Convidar uma pessoa</h2></div><UserRoundPlus size={24} color="#df6825"/></div>
      <p className="muted">O usuário receberá acesso somente após usar o convite e entrar com o mesmo e-mail. A senha nunca será definida pela administração.</p>
      <form onSubmit={invite} style={{display:'grid',gap:14,marginTop:18}}>
       <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>Nome completo<input className="field" required minLength={3} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da pessoa" /></label>
       <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>E-mail autorizado<input className="field" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="pessoa@exemplo.com" /></label>
       <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>Nível de acesso<select className="field" value={role} onChange={e=>setRole(e.target.value as Role)}><option value="agent">Agente de campo</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option></select></label>
       {role==='admin'&&<p className="notice" style={{margin:0}}>Atenção: administradores podem conceder novos acessos. Utilize esta função somente para pessoas autorizadas.</p>}
       <button className="button" type="submit" disabled={busy}><Mail size={16}/>{busy?'Processando...':'Gerar convite seguro'}</button>
      </form>
      {link&&<div className="notice" style={{marginTop:16,overflowWrap:'anywhere'}}><strong>Link de ativação (exibido uma única vez)</strong><p style={{fontSize:12,marginTop:7}}>{link}</p><button type="button" className="button secondary" onClick={async()=>{await navigator.clipboard.writeText(link);setMessage('Link copiado. Compartilhe apenas com o destinatário.')}}><ClipboardCopy size={16}/> Copiar link</button></div>}
      <p className="muted" style={{marginTop:18,display:'flex',gap:7,alignItems:'flex-start'}}><ShieldCheck size={16}/> Os convites expiram em 72 horas e podem ser revogados antes do uso.</p>
    </section>
    <section className="panel">
     <div className="panel-title"><div><small>GESTÃO DE CONVITES</small><h2>Aguardando ativação</h2></div><Link2 size={22} color="#698c78"/></div>
     {pending.length===0?<p className="muted">Nenhum convite pendente.</p>:<div style={{display:'grid',gap:10}}>{pending.map(i=><div key={i.id} style={{border:'1px solid var(--line)',borderRadius:13,padding:15,display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><div style={{minWidth:180}}><strong style={{fontSize:13}}>{i.full_name}</strong><p className="muted" style={{margin:'5px 0'}}>{i.email}</p><span className="pill warn">{labels[i.role]} · até {pt(i.expires_at)}</span></div><button type="button" className="button secondary" disabled={busy} onClick={()=>void revoke(i.id)}><XCircle size={16}/> Revogar</button></div>)}</div>}
     <div className="panel-title" style={{marginTop:27}}><div><small>CADASTROS LIBERADOS</small><h2>Equipe com acesso</h2></div><Check size={20} color="#34885e"/></div>
     <div className="tablewrap"><table><thead><tr><th>Responsável</th><th>Função</th><th>Situação</th></tr></thead><tbody>{profiles.map(p=><tr key={p.auth_user_id}><td><strong>{p.full_name}</strong></td><td>{labels[p.role]}</td><td><span className={p.is_active?'pill':'pill warn'}>{p.is_active?'Ativo':'Inativo'}</span></td></tr>)}{profiles.length===0&&<tr><td colSpan={3}>Nenhum perfil vinculado.</td></tr>}</tbody></table></div>
    </section>
   </div>
   {message&&<p className="success" role="status" style={{marginTop:18}}>{message}</p>}
   {error&&<p className="error" role="alert" style={{marginTop:18}}>{error}</p>}
  </>}
 </Portal>;
}
