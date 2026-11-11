'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,ArrowLeft,LockKeyhole,ShieldCheck,UserPlus,Mail,Eye,EyeOff,CheckCircle2,KeyRound} from 'lucide-react';
import {authClient} from '@/lib/auth/client';
import {AuthShell} from '@/components/auth-shell';

type Mode='login'|'register'|'recover';
const title:Record<Mode,string>={
 login:'Acesse a plataforma',
 register:'Faça parte da equipe.',
 recover:'Recupere sua conta.'
};
const description:Record<Mode,string>={
 login:'Entre com suas credenciais para continuar seu trabalho no SindPetshop-SP.',
 register:'Crie uma conta e envie sua solicitação para análise da administração.',
 recover:'Informe o e-mail cadastrado para receber um link de recuperação de senha.'
};
export default function Login(){
 const router=useRouter();
 const [mode,setMode]=useState<Mode>('login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [visible,setVisible]=useState(false);
 const [confirmVisible,setConfirmVisible]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 function switchMode(next:Mode){
  setMode(next);setError('');setNotice('');setPassword('');setConfirm('');
  setVisible(false);setConfirmVisible(false);
 }
 async function routeAfterLogin(){
  try{
   const r=await fetch('/api/access-requests',{cache:'no-store'});
   if(r.ok){
    const result=await r.json();
    if(!result.authorized)router.replace('/aguardando');
    else{
     const me=await fetch('/api/me',{cache:'no-store'});
     const profile=me.ok?await me.json().catch(()=>null):null;
     router.replace(profile?.user?.role==='agent'?'/agente':'/dashboard');
    }
   }else router.replace('/aguardando');
  }catch{router.replace('/aguardando');}
  router.refresh();
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setNotice('');setBusy(true);
  try{
   if(mode==='recover'){
    const r=await authClient.requestPasswordReset({email:email.trim().toLowerCase(),redirectTo:`${window.location.origin}/redefinir-senha`});
    if(r.error)throw new Error('Não foi possível solicitar a recuperação. Verifique o envio de e-mails no Neon Auth.');
    setNotice('Se a conta existir e o serviço de e-mail estiver habilitado, você receberá as instruções de recuperação.');
   }else if(mode==='register'){
    const fullName=name.trim().replace(/\s+/g,' ');
    if(fullName.length<3)throw new Error('Informe seu nome completo.');
    if(password.length<12)throw new Error('A senha precisa ter pelo menos 12 caracteres.');
    if(password!==confirm)throw new Error('As senhas não coincidem.');
    const account=await authClient.signUp.email({name:fullName,email:email.trim().toLowerCase(),password});
    if(account.error)throw new Error(account.error.message);
    const login=await authClient.signIn.email({email:email.trim().toLowerCase(),password});
    if(login.error){
     switchMode('login');
     setNotice('Conta criada. Verifique seu e-mail, se solicitado pelo Neon Auth, e entre novamente. O acesso depende de aprovação administrativa.');
     return;
    }
    const request=await fetch('/api/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:fullName})});
    if(!request.ok){
     const info=await request.json().catch(()=>({}));
     setNotice(info.error||'Conta criada. Entre novamente para concluir a solicitação de acesso.');
    }
    router.replace('/aguardando');router.refresh();
   }else{
    const r=await authClient.signIn.email({email:email.trim().toLowerCase(),password});
    if(r.error)throw new Error(r.error.message);
    await routeAfterLogin();
   }
  }catch(err){
   setError(err instanceof Error?err.message:'Não foi possível concluir a operação.');
  }finally{setBusy(false)}
 }

 return <AuthShell
  eyebrow={mode==='login'?'ACESSO À ÁREA INTERNA':mode==='register'?'SOLICITAÇÃO DE ACESSO':'SEGURANÇA DA CONTA'}
  title={title[mode]} description={description[mode]}
  footer={<p className="auth-help-note"><ShieldCheck size={16} aria-hidden="true"/> Somente usuários aprovados podem utilizar o sistema.</p>}
 >
  <form className="auth-form" onSubmit={submit} aria-busy={busy}>
   {mode==='register'&&<div className="auth-form-group">
    <label htmlFor="auth-name">Nome completo</label>
    <div className="auth-input-wrap"><UserPlus size={20} aria-hidden="true"/>
     <input id="auth-name" type="text" value={name} onChange={e=>setName(e.target.value)}
      minLength={3} maxLength={120} autoComplete="name" required placeholder="Como você gostaria de ser chamado?"/>
    </div>
   </div>}
   <div className="auth-form-group">
    <label htmlFor="auth-email">E-mail</label>
    <div className="auth-input-wrap"><Mail size={20} aria-hidden="true"/>
     <input id="auth-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false}
      value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required
      placeholder="seuemail@exemplo.com"/>
    </div>
   </div>
   {mode!=='recover'&&<div className="auth-form-group">
    <label htmlFor="auth-password">Senha</label>
    <div className="auth-input-wrap"><LockKeyhole size={20} aria-hidden="true"/>
     <input id="auth-password" type={visible?'text':'password'} value={password}
      onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'}
      minLength={mode==='register'?12:undefined} required
      placeholder={mode==='login'?'Digite sua senha':'Crie uma senha segura'} />
     <button type="button" className="auth-reveal" onClick={()=>setVisible(v=>!v)}
      aria-label={visible?'Ocultar senha':'Mostrar senha'} aria-pressed={visible}>
      {visible?<EyeOff size={20}/>:<Eye size={20}/>}
     </button>
    </div>
    {mode==='register'&&<small className="auth-field-hint">Use uma senha com pelo menos 12 caracteres.</small>}
   </div>}
   {mode==='register'&&<div className="auth-form-group">
    <label htmlFor="auth-confirm">Confirme sua senha</label>
    <div className="auth-input-wrap"><KeyRound size={20} aria-hidden="true"/>
     <input id="auth-confirm" type={confirmVisible?'text':'password'} value={confirm}
      onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={12} required placeholder="Repita a senha"/>
     <button type="button" className="auth-reveal" onClick={()=>setConfirmVisible(v=>!v)}
      aria-label={confirmVisible?'Ocultar confirmação da senha':'Mostrar confirmação da senha'} aria-pressed={confirmVisible}>
      {confirmVisible?<EyeOff size={20}/>:<Eye size={20}/>}
     </button>
    </div>
   </div>}
   {error&&<p className="auth-message auth-error" role="alert">{error}</p>}
   {notice&&<p className="auth-message auth-success" role="status"><CheckCircle2 size={18} aria-hidden="true"/>{notice}</p>}
   <button className="auth-submit" type="submit" disabled={busy}>
    <span>{busy?'Processando...':mode==='login'?'Entrar no sistema':mode==='register'?'Criar conta e solicitar acesso':'Enviar instruções'}</span>
    <ArrowRight size={22} aria-hidden="true"/>
   </button>
  </form>
  {mode==='login'?
   <>
    <div className="auth-links">
     <button type="button" onClick={()=>switchMode('register')} className="auth-secondary-action">Criar conta</button>
     <button type="button" onClick={()=>switchMode('recover')} className="auth-secondary-action">Esqueci minha senha</button>
    </div>
    <Link href="/aguardando" className="auth-access-check">Consultar solicitações de acesso</Link>
   </>:
   <>
    {mode==='register'&&<div className="auth-approval-note"><ShieldCheck size={20}/>
      <span>Seu acesso ficará <strong>aguardando aprovação</strong>. A administração definirá as permissões do seu perfil.</span>
     </div>}
    <button type="button" onClick={()=>switchMode('login')} className="auth-back">
     <ArrowLeft size={17}/> Voltar ao login
    </button>
   </>
  }
 </AuthShell>;
}
