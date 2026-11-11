'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Clock3,ShieldCheck,LogOut,RefreshCw,CheckCircle2,XCircle,AlertTriangle,LogIn} from 'lucide-react';
import {authClient} from '@/lib/auth/client';
import {AuthShell} from '@/components/auth-shell';

type RequestState='pending'|'approved'|'rejected'|null;
export default function Aguardando(){
 const router=useRouter();
 const [status,setStatus]=useState<RequestState>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [signedIn,setSignedIn]=useState(true);
 async function refresh(){
  setLoading(true);setError('');
  try{
   let r=await fetch('/api/access-requests',{cache:'no-store'});
   if(r.status===401){setSignedIn(false);return;}
   if(!r.ok)throw new Error('Não foi possível consultar a solicitação.');
   let result=await r.json();
   if(result.authorized){const me=await fetch('/api/me',{cache:'no-store'});const profile=me.ok?await me.json().catch(()=>null):null;router.replace(profile?.user?.role==='cadastro'?'/cadastros':profile?.user?.role==='rh'?'/reembolsos':profile?.user?.role==='agent'?'/agente':'/dashboard');router.refresh();return;}
   if(!result.request){
    r=await fetch('/api/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    if(!r.ok){const info=await r.json().catch(()=>({}));throw new Error(info.error||'Não foi possível registrar a solicitação.');}
    result={request:await r.json()};
   }
   setSignedIn(true);
   setStatus(result.request?.status||result.request?.request?.status||result.status||'pending');
  }catch(e){setError(e instanceof Error?e.message:'Falha na consulta da solicitação.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 async function signOut(){
  await authClient.signOut();router.push('/login');router.refresh();
 }
 const heading=loading?'Verificando sua conta...':!signedIn?'Entre para consultar':status==='rejected'?'Solicitação não aprovada.':error?'Não foi possível consultar.':'Aguardando aprovação.';
 const desc=loading?'Estamos verificando a situação do seu cadastro.':!signedIn?'Entre com o e-mail e a senha utilizados no cadastro para acompanhar sua solicitação.':status==='rejected'?'A administração não autorizou este acesso. Procure um administrador para orientação.':error||'Recebemos sua solicitação. Você terá acesso às ferramentas após a aprovação da administração.';
 return <AuthShell eyebrow="SOLICITAÇÃO DE ACESSO" title={heading} description={desc}
>
  {!loading&&signedIn&&!error&&<div className="auth-state-note">
   {status==='rejected'?<XCircle size={23} aria-hidden="true"/>:status==='approved'?<CheckCircle2 size={23} aria-hidden="true"/>:<Clock3 size={23} aria-hidden="true"/>}
   <span>{status==='rejected'?'Caso precise de orientação, converse com a administração.':status==='approved'?'Sua solicitação foi aprovada. Atualize a situação para confirmar o acesso.':'Seu cadastro está protegido. Até a aprovação, nenhuma informação interna ficará disponível.'}</span>
  </div>}
  {error&&<p className="auth-message auth-error" role="alert"><AlertTriangle size={18} aria-hidden="true"/>{error}</p>}
  <div className="auth-content-action-row">
   {signedIn?
    <>
     <button type="button" className="auth-submit" disabled={loading} onClick={()=>void refresh()}>
      <RefreshCw size={19} aria-hidden="true"/>{loading?'Verificando...':'Atualizar situação'}
     </button>
     <button type="button" className="auth-outline-button" onClick={()=>void signOut()}>
      <LogOut size={19} aria-hidden="true"/> Sair
     </button>
    </>:
    <Link href="/login" className="auth-submit"><LogIn size={20} aria-hidden="true"/> Ir para o login</Link>
   }
  </div>
  {!signedIn&&<p className="auth-help-note"><ShieldCheck size={16} aria-hidden="true"/> Para acompanhar a solicitação, utilize a mesma conta criada no cadastro.</p>}
 </AuthShell>;
}
