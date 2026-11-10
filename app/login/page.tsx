'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, LockKeyhole, ShieldCheck, UserPlus, Mail } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { BrandMark } from '@/components/brand-mark';

type Mode='login'|'register'|'recover';
export default function Login(){
 const router=useRouter();
 const [mode,setMode]=useState<Mode>('login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 function switchMode(next:Mode){setMode(next);setError('');setNotice('');setPassword('');setConfirm('');}
 async function routeAfterLogin(){
   try {
     const r=await fetch('/api/access-requests',{cache:'no-store'});
     if(r.ok){const result=await r.json();router.replace(result.authorized?'/dashboard':'/aguardando');}
     else router.replace('/aguardando');
   }catch{router.replace('/aguardando');}
   router.refresh();
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setNotice('');setBusy(true);
  try{
   if(mode==='recover'){
     const r=await authClient.requestPasswordReset({email:email.trim().toLowerCase(),redirectTo:`${window.location.origin}/redefinir-senha`});
     if(r.error)throw new Error('Não foi possível solicitar a recuperação. Verifique o envio de e-mails no Neon Auth.');
     setNotice('Se a conta existir e o serviço de e-mail estiver habilitado, você receberá instruções de recuperação.');
   } else if(mode==='register'){
     const fullName=name.trim().replace(/\s+/g,' ');
     if(fullName.length<3)throw new Error('Informe seu nome completo.');
     if(password.length<12)throw new Error('A senha precisa ter pelo menos 12 caracteres.');
     if(password!==confirm)throw new Error('As senhas não coincidem.');
     const account=await authClient.signUp.email({name:fullName,email:email.trim().toLowerCase(),password});
     if(account.error)throw new Error(account.error.message);
     const login=await authClient.signIn.email({email:email.trim().toLowerCase(),password});
     if(login.error){switchMode('login');setNotice('Conta criada. Verifique seu e-mail, se solicitado pelo Neon Auth, e volte para entrar. Seu acesso só será liberado após aprovação administrativa.');return;}
     const request=await fetch('/api/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:fullName})});
     if(!request.ok){const info=await request.json().catch(()=>({}));setNotice(info.error||'Conta criada. Entre novamente para concluir a solicitação de acesso.');}
     router.replace('/aguardando');router.refresh();
   } else {
     const r=await authClient.signIn.email({email:email.trim().toLowerCase(),password});
     if(r.error)throw new Error(r.error.message);
     await routeAfterLogin();
   }
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível concluir a operação.');}
  finally{setBusy(false);}
 }
 const titles={login:'Bem-vindo de volta.',register:'Solicite seu acesso.',recover:'Recupere sua conta.'};
 const descriptions={login:'Entre com suas credenciais autorizadas para continuar.',register:'Crie sua conta para solicitar aprovação da administração do SindPetshop-SP.',recover:'Informe o e-mail cadastrado para receber um link de recuperação, se o serviço estiver habilitado.'};
 return <main className="login-page">
  <section className="login-story"><div style={{display:'flex',alignItems:'center',gap:12}}><BrandMark size={47}/><div style={{fontWeight:800,letterSpacing:'-.5px'}}>SindPetshop-SP<small style={{display:'block',fontWeight:500,opacity:.7,fontSize:11}}>Campo &amp; Território</small></div></div><div><span className="tiny-label">A PRESENÇA FAZ A DIFERENÇA</span><h1>Mais perto de quem <span>cuida.</span></h1><p>Informação, planejamento e trabalho de campo para fortalecer a representação dos profissionais do setor pet.</p></div><div style={{fontSize:11,color:'#9fc1ad'}}>Plataforma de uso interno · SindPetshop-SP</div><div className="login-illustration" aria-hidden="true">✳</div></section>
  <section className="login-content"><div className="login-box">
   <div style={{display:'flex',alignItems:'center',gap:8,color:'#cc6d32',fontSize:11,fontWeight:800,marginBottom:23}}>{mode==='login'?<LockKeyhole size={16}/>:mode==='register'?<UserPlus size={16}/>:<Mail size={16}/>} {mode==='login'?'ACESSO RESTRITO':mode==='register'?'NOVO CADASTRO':'RECUPERAÇÃO DE SENHA'}</div>
   <h2>{titles[mode]}</h2><p>{descriptions[mode]}</p>
   <form onSubmit={submit}>
    {mode==='register'&&<label>Nome completo<input className="field" value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={120} autoComplete="name" required placeholder="Seu nome completo"/></label>}
    <label>E-mail<input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="seuemail@exemplo.com"/></label>
    {mode!=='recover'&&<label>Senha<input className="field" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='register'?12:undefined} required placeholder="Sua senha"/></label>}
    {mode==='register'&&<label>Confirme a senha<input className="field" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={12} required placeholder="Repita a senha"/></label>}
    {error&&<p className="error" role="alert">{error}</p>}
    {notice&&<p className="success" role="status">{notice}</p>}
    <button className="button" disabled={busy} type="submit">{busy?'Processando...':mode==='login'?'Entrar no sistema':mode==='register'?'Criar conta e solicitar aprovação':'Enviar instruções'} <ArrowRight size={16}/></button>
   </form>
   <div style={{marginTop:18,display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
    {mode==='login'?<><button type="button" onClick={()=>switchMode('register')} className="link-inline" style={{border:0,background:'none',cursor:'pointer'}}>Criar conta</button><button type="button" onClick={()=>switchMode('recover')} className="link-inline" style={{border:0,background:'none',cursor:'pointer'}}>Esqueci minha senha</button></>:<button type="button" onClick={()=>switchMode('login')} className="link-inline" style={{border:0,background:'none',cursor:'pointer'}}><ArrowLeft size={14}/> Voltar ao login</button>}
   </div>
   {mode==='register'&&<div className="notice" style={{marginTop:20}}>Seu cadastro ficará <strong>aguardando aprovação</strong>. A administração definirá se seu perfil será agente, supervisor ou administrador.</div>}
   <p className="login-foot"><ShieldCheck size={14} style={{display:'inline',verticalAlign:'middle',marginRight:5}}/> Somente usuários aprovados podem utilizar o sistema.</p>
   <Link href="/aguardando" style={{fontSize:11,color:'#789082'}}>Consultar solicitação de acesso</Link>
  </div></section>
 </main>
}
