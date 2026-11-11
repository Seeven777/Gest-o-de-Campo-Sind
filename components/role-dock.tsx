'use client';

import Link from 'next/link';
import {Building2,Camera,CheckCheck,House,MoreHorizontal,Route,ChartNoAxesCombined,Wallet, type LucideIcon} from 'lucide-react';

export type DockRole='admin'|'supervisor'|'agent';
type NavItem={href:string;label:string;icon:LucideIcon;featured?:boolean};
const destinations:Record<DockRole,NavItem[]>={
 admin:[
  {href:'/dashboard',label:'Início',icon:House},
  {href:'/empresas',label:'Empresas',icon:Building2},
  {href:'/rotas',label:'Rotas',icon:Route,featured:true},
  {href:'/validacoes',label:'Validar',icon:CheckCheck}
 ],
 supervisor:[
  {href:'/dashboard',label:'Início',icon:House},
  {href:'/rotas',label:'Rotas',icon:Route},
  {href:'/visitas',label:'Visitas',icon:Camera,featured:true},
  {href:'/relatorios',label:'Relatórios',icon:ChartNoAxesCombined}
 ],
 agent:[
  {href:'/agente',label:'Meu dia',icon:House},
  {href:'/rotas',label:'Rotas',icon:Route},
  {href:'/visitas',label:'Registrar',icon:Camera,featured:true},
  {href:'/reembolsos',label:'Despesas',icon:Wallet}
 ]
};
function isCurrent(pathname:string,href:string){
 if(pathname===href||pathname.startsWith(href+'/'))return true;
 return href==='/rotas'&&pathname.startsWith('/campo/');
}
export function RoleDock({role,pathname,onMore,moreOpen=false}:{role:DockRole;pathname:string;onMore:()=>void;moreOpen?:boolean}){
 return <nav className="role-dock" aria-label="Navegação principal">
  <div className="role-dock-track">
   {destinations[role].map(({href,label,icon:Icon,featured})=>{
    const active=isCurrent(pathname,href);
    return <Link href={href} key={href} aria-current={active?'page':undefined}
     className={['role-dock-item',active?'is-active':'',featured?'is-featured':''].filter(Boolean).join(' ')}
     title={label}>
     <span className="role-dock-icon"><Icon size={featured?25:23} strokeWidth={active?2.45:2} aria-hidden="true"/></span>
     <span className="role-dock-label">{label}</span>
    </Link>
   })}
   <button className={'role-dock-item role-dock-more'+(moreOpen?' is-active':'')} type="button"
    aria-label="Abrir todas as funções" aria-expanded={moreOpen} aria-controls="role-dock-more-panel"
    onClick={onMore} title="Mais funções">
    <span className="role-dock-icon"><MoreHorizontal size={25} strokeWidth={2.2} aria-hidden="true"/></span>
    <span className="role-dock-label">Mais</span>
   </button>
  </div>
 </nav>;
}
