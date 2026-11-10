'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X, ShieldCheck, MapPinned } from 'lucide-react';
import { adminMenu,agentMenu } from '@/lib/menu';
import { getSupabase } from '@/lib/supabase';
type Profile={id:string;full_name:string;role:'admin'|'supervisor'|'agent'};
export function Portal({children,title,subtitle}:{children:React.ReactNode;title:string;subtitle?:string}) {
 const [profile,setProfile]=useState<Profile|null>(null);
 const [ready,setReady]=useState(false);
 const [opened,setOpened]=useState(false);
 const router=useRouter();const pathname=usePathname();
 useEffect(()=>{let active=true; (async()=>{
   const supabase=getSupabase();if(!supabase){setReady(true);return;}
   const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/login');return;}
   const {data,error}=await supabase.from('profiles').select('id,full_name,role').eq('id',user.id).single();
   if(!active)return;
   if(error||!data){setReady(true);return;}
   setProfile(data as Profile);setReady(true);
 })();return()=>{active=false};},[router]);
 const configured=!!getSupabase();
 if(!ready) return <main className="loading">Verificando acesso...</main>;
 if(configured&&!profile)return <main className="loading">Usuário sem perfil autorizado. Solicite acesso ao administrador.</main>;
 const isAgent=profile?.role==='agent';const items=isAgent?agentMenu:adminMenu;
 return <div className="shell">
 <aside className={`sidebar ${opened?'open':''}`}>
 <div className="brand"><MapPinned size={27}/><div><strong>SindPetshop-SP</strong><small>Gestão de Campo</small></div><button className="mobile-only icon-button" onClick={()=>setOpened(false)} aria-label="Fechar menu"><X/></button></div>
 <div className="sidebar-caption">{isAgent?'APLICAÇÃO DO AGENTE':'PAINEL ADMINISTRATIVO'}</div>
 <nav>{items.map(({label,href,icon:Icon})=><Link onClick={()=>setOpened(false)} className={`nav-item ${pathname===href?'current':''}`} href={href} key={href}><Icon size={18}/>{label}</Link>)}</nav>
 <div className="sidebar-bottom"><div className="identity"><ShieldCheck size={18}/><span>{profile?profile.full_name:'Modo de demonstração'}<small>{profile?profile.role:'Sem conexão Supabase'}</small></span></div>{configured&&<button className="nav-item logout" onClick={async()=>{await getSupabase()?.auth.signOut();router.replace('/login')}}><LogOut size={17}/> Sair</button>}</div>
 </aside>
 <div className="content"><header className="topbar"><button className="icon-button mobile-only" onClick={()=>setOpened(true)} aria-label="Abrir menu"><Menu/></button><span>Operações de campo / {title}</span><span className="topbar-tag">{configured?'Ambiente conectado':'Prévia local'}</span></header><main className="main"><div className="page-head"><div><h1>{title}</h1><p>{subtitle||'Plataforma de captação e inteligência territorial'}</p></div></div>{!configured&&<div className="notice"><strong>Modo de demonstração.</strong> Configure o Supabase para habilitar persistência, autenticação e importação real.</div>}{children}</main></div>
 </div>
}
