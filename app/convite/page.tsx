'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { BrandMark } from '@/components/brand-mark';

type Invitation = {email:string;full_name:string;role:string;expires_at:string};
export default function Convite(){
 const router=useRouter();
 const [token,setToken]=useState('');
 const [invite,setInvite]=useState<Invitation|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [mode,setMode]=useState<'register'|'existing'>('register');
 useEffect(()=>{
   const value=new URLSearchParams(window.location.search).get('token')||'';
   setToken(value);
   if(!value){setLoading(false);setError('Link de convite inválido.');return;}
   fetch('/api/access-invitations/redeem?token='+encodeURIComponent(value),{cache:'no-store'})
    .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Convite inválido.');return j.invitation;})
    .then(setInvite).catch(e=>setError(e.message)).finally(()=>setLoading(false));
 },[]);
 async function activate(){
   const result=await fetch('/api/access-invitations/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   const body=await result.json();
   if(result.ok){router.replace('/dashboard');router.refresh();return true;}
   if(result.status===401){setMode('existing');setMessage('Conta registrada. Entre com seu e-mail e senha para concluir a ativação.');return false;}
   throw Error(body.error||'Não foi possível liberar o acesso.');
 }
 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setError('');setMessage('');
   if(!invite)return;
   if(password.length<12){setError('A senha precisa ter pelo menos 12 caracteres.');return;}
   setBusy(true);
   try{
     if(mode==='register'){
       const result=await authClient.signUp.email({email:invite.email,name:invite.full_name,password});
       if(result.error)throw Error('Não foi possível criar a conta. Se ela já existir, selecione “Já tenho conta”.');
     }else{
       const result=await authClient.signIn.email({email:invite.email,password});
       if(result.error)throw Error('E-mail ou senha inválidos.');
     }
     await activate();
   }catch(e){setError(e instanceof Error?e.message:'Não foi possível ativar.');}
   finally{setBusy(false);}
 }
 return <main className="login-page">
  <section className="login-story"><div style={{display:'flex',alignItems:'center',gap:12}}><BrandMark size={47}/><div style={{fontWeight:800}}>SindPetshop-SP<small style={{display:'block',fontWeight:500,opacity:.7,fontSize:11}}>Campo &amp; Território</small></div></div><div><span className="tiny-label">CONVITE INDIVIDUAL</span><h1>Bem-vindo a quem <span>faz acontecer.</span></h1><p>Uma plataforma para fortalecer a atuação do SindPetshop-SP em cada cidade.</p></div><div style={{fontSize:11,color:'#9fc1ad'}}>Plataforma de uso interno · SindPetshop-SP</div></section>
  <section className="login-content"><div className="login-box"><div style={{display:'flex',alignItems:'center',gap:8,color:'#cc6d32',fontSize:11,fontWeight:800,marginBottom:23}}><LockKeyhole size={16}/> ATIVAÇÃO DE ACESSO</div>
   <h2>{loading?'Validando convite...':invite?'Seu acesso começa aqui.':'Convite indisponível'}</h2>
   {invite?<><p>Convite para <strong>{invite.full_name}</strong> ({invite.email}). Apenas essa conta poderá ativar o acesso.</p>
     <form onSubmit={submit}><label>Seu e-mail<input className="field" value={invite.email} readOnly autoComplete="email" /></label><label>{mode==='register'?'Crie uma senha':'Senha existente'}<input className="field" type="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={12} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 12 caracteres" /></label>
     {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
     <button className="button" disabled={busy} type="submit">{busy?'Processando...':mode==='register'?'Criar conta e ativar':'Entrar e ativar'} <ArrowRight size={16}/></button></form>
     <button type="button" className="button secondary" style={{marginTop:12,width:'100%'}} onClick={()=>{setMode(mode==='register'?'existing':'register');setPassword('');setError('');setMessage('');}}>{mode==='register'?'Já tenho conta no Neon Auth':'Ainda não tenho conta'}</button>
   </>:<><p>{loading?'Estamos verificando seu convite.':error||'Solicite um novo convite à administração.'}</p><Link className="button secondary" href="/login">Ir para login</Link></>}
   <p className="login-foot"><ShieldCheck size={14} style={{display:'inline',verticalAlign:'middle',marginRight:5}}/> Acesso liberado somente após conferência do convite pela plataforma.</p>
  </div></section>
 </main>;
}
