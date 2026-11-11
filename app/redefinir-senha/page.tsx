'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,Eye,EyeOff,KeyRound,LockKeyhole,ShieldCheck} from 'lucide-react';
import {AuthShell} from '@/components/auth-shell';
import {authClient} from '@/lib/auth/client';

export default function RedefinirSenha(){
 const [token,setToken]=useState<string|null>(null);
 const [checked,setChecked]=useState(false);
 const [invalid,setInvalid]=useState(false);
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState(false);
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
  // Neon Auth envia token pela query string; mantém fallback para links com hash.
  setToken(q.get('token')||hash.get('token'));
  setInvalid(Boolean(q.get('error')||hash.get('error')));
  setChecked(true);
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  if(!token||invalid){setError('O link de recuperação está inválido ou expirou. Solicite um novo.');return;}
  if(password.length<12){setError('Escolha uma senha com pelo menos 12 caracteres.');return;}
  if(password!==confirm){setError('As senhas não coincidem.');return;}
  setBusy(true);
  try{
   const response=await authClient.resetPassword({newPassword:password,token});
   if(response.error)throw Error('Não foi possível redefinir sua senha. Solicite um novo link.');
   setSuccess(true);setPassword('');setConfirm('');
   window.history.replaceState(null,'','/redefinir-senha');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao redefinir senha.');}
  finally{setBusy(false);}
 }
 return <AuthShell eyebrow="REDEFINIÇÃO DE SENHA"
  title={success?'Senha atualizada.':'Crie sua nova senha.'}
  description={success?'Você já pode entrar utilizando sua nova senha.':'Escolha uma senha exclusiva para proteger sua conta.'}
  footer={<p className="auth-help-note"><ShieldCheck size={16}/> Não compartilhe links de recuperação com outras pessoas.</p>}>
  {!checked?<p className="auth-state-note">Verificando link de recuperação...</p>:
   success?<div className="auth-recovery-success">
    <p className="auth-message auth-success"><CheckCircle2 size={21}/> A senha foi atualizada com sucesso.</p>
    <Link href="/login" className="auth-submit">Ir para o login <ArrowRight size={19}/></Link>
   </div>:
   !token||invalid?<div className="auth-recovery-expired">
    <p className="auth-state-note">Este link não contém um token válido ou expirou. Volte ao login e solicite outra recuperação.</p>
    <Link href="/login" className="auth-back"><ArrowLeft size={19}/> Voltar ao login</Link>
   </div>:
   <form className="auth-form" onSubmit={submit} aria-busy={busy}>
    <div className="auth-form-group">
     <label htmlFor="new-password">Nova senha</label>
     <div className="auth-input-wrap"><LockKeyhole size={20} aria-hidden="true"/>
      <input id="new-password" type={showPassword?'text':'password'} minLength={12} required
       autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}
       placeholder="Pelo menos 12 caracteres" />
      <button type="button" className="auth-reveal" onClick={()=>setShowPassword(v=>!v)}
       aria-label={showPassword?'Ocultar senha':'Mostrar senha'} aria-pressed={showPassword}>
       {showPassword?<EyeOff size={20}/>:<Eye size={20}/>}
      </button>
     </div>
    </div>
    <div className="auth-form-group">
     <label htmlFor="repeat-password">Confirme a nova senha</label>
     <div className="auth-input-wrap"><KeyRound size={20} aria-hidden="true"/>
      <input id="repeat-password" type={showConfirm?'text':'password'} minLength={12} required
       autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}
       placeholder="Repita a nova senha" />
      <button type="button" className="auth-reveal" onClick={()=>setShowConfirm(v=>!v)}
       aria-label={showConfirm?'Ocultar confirmação':'Mostrar confirmação'} aria-pressed={showConfirm}>
       {showConfirm?<EyeOff size={20}/>:<Eye size={20}/>}
      </button>
     </div>
    </div>
    {error&&<p className="auth-message auth-error" role="alert">{error}</p>}
    <button type="submit" className="auth-submit" disabled={busy}>{busy?'Atualizando...':'Salvar nova senha'}<ArrowRight size={19}/></button>
   </form>}
 </AuthShell>;
}
