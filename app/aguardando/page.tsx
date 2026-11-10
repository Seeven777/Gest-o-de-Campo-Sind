'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Clock3,ShieldCheck,LogOut,RefreshCw} from 'lucide-react';
import {authClient} from '@/lib/auth/client';
import {BrandMark} from '@/components/brand-mark';

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
    if(result.authorized){router.replace('/dashboard');router.refresh();return;}
    if(!result.request){
      r=await fetch('/api/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
      if(!r.ok){const info=await r.json().catch(()=>({}));throw new Error(info.error||'Não foi possível registrar a solicitação.');}
      result={request:await r.json()};
    }
    setStatus(result.request?.status||result.request?.request?.status||result.request?.status||result.status||'pending');
  }catch(e){setError(e instanceof Error?e.message:'Falha de consulta.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 return <main className="login-page"><section className="login-story"><div style={{display:'flex',alignItems:'center',gap:12}}><BrandMark size={47}/><div style={{fontWeight:800}}>SindPetshop-SP<small style={{display:'block',fontSize:11,opacity:.7}}>Campo &amp; Território</small></div></div><div><span className="tiny-label">ACESSO CONTROLADO</span><h1>Sua participação <span>começa aqui.</span></h1><p>As contas passam por análise administrativa antes da liberação do sistema.</p></div><div style={{fontSize:11,color:'#9fc1ad'}}>Plataforma de uso interno · SindPetshop-SP</div></section>
 <section className="login-content"><div className="login-box"><div style={{display:'flex',alignItems:'center',gap:8,color:'#cc6d32',fontSize:11,fontWeight:800,marginBottom:23}}><ShieldCheck size={16}/> SOLICITAÇÃO DE ACESSO</div>
  <h2>{loading?'Verificando sua conta...':!signedIn?'Entre em sua conta':status==='rejected'?'Solicitação não aprovada.':error?'Não foi possível concluir.':'Aguardando aprovação.'}</h2>
  <p>{loading?'Consultando sua situação.':!signedIn?'Entre com o e-mail e a senha usados no cadastro para registrar ou consultar sua solicitação.':status==='rejected'?'A administração não autorizou este acesso. Procure um administrador para orientação.':error||'Sua solicitação está registrada. Quando um administrador aprovar, você poderá entrar na plataforma.'}</p>
  {!loading&&signedIn&&status!=='rejected'&&!error&&<div className="notice"><Clock3 size={17} style={{verticalAlign:'middle',marginRight:8}}/>Você ainda não tem permissões de administrador, supervisor ou agente. Nenhum dado interno está disponível até a aprovação.</div>}
  {error&&<p className="error" role="alert">{error}</p>}
  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}>
   <button className="button" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> Atualizar situação</button>
   <button className="button secondary" type="button" onClick={async()=>{await authClient.signOut();router.push('/login');router.refresh()}}><LogOut size={16}/> Sair</button>
  </div>
  {!signedIn&&<p style={{marginTop:20}}><Link className="link-inline" href="/login">Ir para o login</Link></p>}
 </div></section></main>;
}
