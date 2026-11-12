'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowUpRight,Bell,ChevronRight,LogOut,Menu,PanelLeftClose,X} from 'lucide-react';
import {RoleDock} from '@/components/role-dock';
import {BrandMark} from '@/components/brand-mark';
import {adminMenu,agentMenu,cadastroMenu,rhMenu} from '@/lib/menu';
import {authClient} from '@/lib/auth/client';
type User={id:string;name:string;email:string;role:'admin'|'supervisor'|'agent'|'cadastro'|'rh'};
export function Portal({title,subtitle,children,action,immersive=false}:{title:string;subtitle?:string;children:React.ReactNode;action?:React.ReactNode;immersive?:boolean}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[sessionError,setSessionError]=useState(false),[retry,setRetry]=useState(0),[drawer,setDrawer]=useState(false),[collapsed,setCollapsed]=useState(false),[moreOpen,setMoreOpen]=useState(false);
 const router=useRouter(),pathname=usePathname();
 useEffect(()=>{
  let live=true;
  fetch('/api/me',{cache:'no-store'})
   .then(async r=>{
    if(r.status===401){router.replace('/login');return null}
    if(!r.ok)throw Error('Falha ao consultar sua sessão.');
    return r.json();
   })
   .then(data=>{
    if(!live)return;
    if(!data?.user){setSessionError(true);return}
    setSessionError(false);setUser(data.user);
    if(data.user.role==='agent'&&pathname==='/dashboard')router.replace('/agente');
    if(data.user.role==='cadastro'&&!['/cadastros','/configuracoes'].includes(pathname))router.replace('/cadastros');
    if(data.user.role==='rh'&&!['/reembolsos','/configuracoes'].includes(pathname))router.replace('/reembolsos');
   })
   .catch(()=>{if(live)setSessionError(true)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[router,pathname,retry]);
 const agent=user?.role==='agent';
 const registrar=user?.role==='cadastro';
 const rh=user?.role==='rh';
 const supervisorLinks=new Set(['/dashboard','/empresas','/rotas','/visitas','/validacoes','/mapa','/localizacoes','/relatorios','/importacoes','/configuracoes']);
 const items=rh?rhMenu:registrar?cadastroMenu:agent?agentMenu:adminMenu.filter(item=>user?.role==='admin'||supervisorLinks.has(item.href));
 const groups=[['principal','Início'],['campo','Campo'],['captacao','Captação'],['gestao','Gestão'],['sistema','Conta']] as const;
 const currentGroup=pathname.startsWith('/campo/')?'campo':items.find(i=>pathname===i.href||pathname.startsWith(i.href+'/'))?.group;
 const activeGroup=groups.find(([key])=>key===currentGroup);
 const sectionItems=items.filter(i=>i.group===currentGroup);
 if(loading)return <div className="loading-screen"><BrandMark size={52}/><p>Preparando seu espaço de trabalho...</p></div>;
 if(!user)return <div className="loading-screen"><BrandMark size={52}/>
  <h2>{sessionError?'Não foi possível carregar sua sessão':'Acesso restrito'}</h2>
  <p>{sessionError?'Verifique sua conexão e tente novamente. Nenhuma alteração foi realizada.':'Entre na sua conta ou solicite que a administração libere seu perfil.'}</p>
  {sessionError&&<button type="button" className="button" onClick={()=>{setLoading(true);setRetry(n=>n+1)}}>Tentar novamente</button>}
  <Link className="button" href="/login">Ir para o acesso</Link>
 </div>;
 if(rh&&!['/reembolsos','/configuracoes'].includes(pathname))return <div className="loading-screen"><BrandMark size={45}/><p>Direcionando para a área do RH...</p></div>;
 if(registrar&&!['/cadastros','/configuracoes'].includes(pathname))return <div className="loading-screen"><BrandMark size={45}/><p>Direcionando para a área de cadastro...</p></div>;
 return <div className={`app-shell ${collapsed?'collapsed':''} ${immersive?'journey-shell':''}`}>
  <aside className={`side ${drawer?'shown':''}`}>
    <div className="side-head"><Link href={agent?'/agente':registrar?'/cadastros':rh?'/reembolsos':'/dashboard'} className="brand"><BrandMark size={42}/><div><strong>SindPetshop<span>-SP</span></strong><small>Campo & Território</small></div></Link><button className="icon-btn side-close" aria-label="Fechar" onClick={()=>setDrawer(false)}><X size={19}/></button></div>
    <div className="side-scroll"><div className="side-unit"><span className="eyebrow">{agent?'ESPAÇO DO AGENTE':registrar?'EQUIPE DE CADASTRO':rh?'RECURSOS HUMANOS':'CENTRAL DE OPERAÇÕES'}</span><strong>{agent?'Sua jornada de campo':registrar?'Confirmação na base sindical':rh?'Conferência e pagamento de reembolsos':'Onde a presença vira resultado.'}</strong></div>
    <nav aria-label="Navegação principal">{groups.map(([g,groupLabel])=>{const subset=items.filter(i=>i.group===g);return subset.length?<div className="nav-section" key={g}><span className="nav-caption">{groupLabel}</span>{subset.map(({href,label,icon:Icon})=><Link key={href} href={href} title={label} onClick={()=>setDrawer(false)} className={`side-link ${pathname===href?'active':''}`}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{pathname===href&&<span className="active-pin"/>}</Link>)}</div>:null})}</nav></div>
    <div className="side-footer"><div className="avatar">{user.name.charAt(0).toUpperCase()}</div><div className="user-info"><strong>{user.name}</strong><small>{user.role==='admin'?'Administração':user.role==='supervisor'?'Supervisão':registrar?'Cadastro sindical':rh?'Recursos Humanos':'Agente de campo'}</small></div><button aria-label="Sair" className="icon-btn" onClick={async()=>{await authClient.signOut();router.replace('/login')}}><LogOut size={18}/></button></div>
  </aside>
  {drawer&&<button aria-label="Fechar menu" className="scrim" onClick={()=>setDrawer(false)}/>}
  {moreOpen&&<div className="dock-more-root" id="role-dock-more-panel" onKeyDown={e=>{if(e.key==='Escape')setMoreOpen(false)}}>
   <button type="button" className="dock-more-backdrop" onClick={()=>setMoreOpen(false)} aria-label="Fechar o menu de funções"/>
   <section className="dock-more-sheet" role="dialog" aria-modal="true" aria-labelledby="dock-more-heading">
    <div className="dock-more-handle" aria-hidden="true"/>
    <div className="dock-more-heading">
     <div><span>ENCONTRE O QUE PRECISA</span><h2 id="dock-more-heading">Áreas de trabalho</h2></div>
     <button className="dock-more-close" type="button" onClick={()=>setMoreOpen(false)} aria-label="Fechar"><X size={21}/></button>
    </div>
    <div className="dock-more-groups">{groups.map(([group,label])=>{
     const subset=items.filter(item=>item.group===group);
     if(!subset.length)return null;
     return <div className="dock-more-group" key={group}>
      <h3>{label}</h3>
      <div className="dock-more-links">{subset.map(({href,label:navLabel,icon:Icon})=>
       <Link key={href} href={href} onClick={()=>setMoreOpen(false)} aria-current={pathname===href?'page':undefined}
        className={'dock-more-link'+(pathname===href?' active':'')}>
        <span className="dock-more-link-icon"><Icon size={21}/></span>
        <span>{navLabel}</span>
       </Link>
      )}</div>
     </div>;
    })}</div>
    <div className="dock-more-profile">
     <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
     <div><strong>{user.name}</strong><span>{user.role==='admin'?'Administrador':user.role==='supervisor'?'Supervisor':registrar?'Cadastro sindical':rh?'Recursos Humanos':'Agente de campo'}</span></div>
     <button type="button" aria-label="Sair da conta" onClick={async()=>{setMoreOpen(false);await authClient.signOut();router.replace('/login')}}><LogOut size={21}/></button>
    </div>
   </section>
  </div>}
  <div className="workspace"><header className="topbar"><div className="topbar-left"><button aria-label="Abrir menu" className="icon-btn menu-mobile" onClick={()=>setDrawer(true)}><Menu size={21}/></button><button aria-label="Recolher menu" className="icon-btn menu-desktop" onClick={()=>setCollapsed(x=>!x)}><PanelLeftClose size={20}/></button><span className="breadcrumbs">SindPetshop-SP <ChevronRight size={14}/> <b>{title}</b></span></div><div className="topbar-right"><span className="env-pill"><span/> Operação interna</span><button className="icon-btn" aria-label="Notificações ainda não implementadas" title="Notificações na próxima etapa" disabled><Bell size={19}/></button><div className="avatar small">{user.name.charAt(0).toUpperCase()}</div></div></header>
  <main className="page-wrap"><div className="page-heading"><div><span className="kicker"><span className="kicker-dot"/> CENTRAL SINDPETSHOP-SP</span><h1>{title}</h1><p>{subtitle||'Sua operação territorial, de ponta a ponta.'}</p></div>{action&&<div className="heading-action">{action}</div>}</div>{!immersive&&sectionItems.length>1&&<nav className="workspace-tabs" aria-label={'Funções de '+(activeGroup?.[1]||'trabalho')}><span className="workspace-tabs-label">{activeGroup?.[1]}</span><div className="workspace-tabs-items">{sectionItems.map(item=>{const Icon=item.icon;const selected=pathname===item.href||pathname.startsWith(item.href+'/');return <Link href={item.href} key={item.href} aria-current={selected?'page':undefined} className={'workspace-tab'+(selected?' active':'')}><Icon size={17} aria-hidden="true"/>{item.label}</Link>})}</div></nav>}{children}<footer className="page-footer"><span>SindPetshop-SP · Gestão territorial</span><span>Protegendo quem cuida <ArrowUpRight size={13}/></span></footer></main></div>
 {!immersive&&<RoleDock role={user.role} pathname={pathname} moreOpen={moreOpen} onMore={()=>{setDrawer(false);setMoreOpen(x=>!x)}}/>}
</div>
}
