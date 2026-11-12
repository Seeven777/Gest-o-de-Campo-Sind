'use client';
import Link from 'next/link';
import {Building2,Camera,CheckCheck,House,MoreHorizontal,Route,Wallet,Users,type LucideIcon} from 'lucide-react';
export type DockRole='admin'|'supervisor'|'agent'|'cadastro'|'rh';
type NavItem={href:string;label:string;icon:LucideIcon;featured?:boolean;aliases?:string[]};
const sections:Record<DockRole,NavItem[]>={
 admin:[
  {href:'/dashboard',label:'Início',icon:House},
  {href:'/rotas',label:'Campo',icon:Route,featured:true,aliases:['/visitas','/validacoes','/campo']},
  {href:'/empresas',label:'Captação',icon:Building2,aliases:['/cadastros','/mapa','/relatorios']},
  {href:'/equipes',label:'Gestão',icon:Users,aliases:['/reembolsos','/localizacoes','/importacoes']},
 ],
 supervisor:[
  {href:'/dashboard',label:'Início',icon:House},
  {href:'/rotas',label:'Campo',icon:Route,featured:true,aliases:['/visitas','/validacoes','/campo']},
  {href:'/empresas',label:'Captação',icon:Building2,aliases:['/mapa','/relatorios']},
  {href:'/localizacoes',label:'Equipe',icon:Users},
 ],
 agent:[
  {href:'/agente',label:'Meu dia',icon:House},
  {href:'/rotas',label:'Rotas',icon:Route,featured:true,aliases:['/campo']},
  {href:'/visitas',label:'Visitas',icon:Camera},
  {href:'/reembolsos',label:'Despesas',icon:Wallet},
 ],
 cadastro:[
  {href:'/cadastros',label:'Cadastros',icon:CheckCheck,featured:true},
  {href:'/configuracoes',label:'Meu perfil',icon:House},
 ],
 rh:[
  {href:'/reembolsos',label:'Reembolsos',icon:Wallet,featured:true},
  {href:'/configuracoes',label:'Meu perfil',icon:House},
 ]
};
function current(path:string,item:NavItem){
 const paths=[item.href,...(item.aliases||[])];
 return paths.some(h=>path===h||path.startsWith(h+'/'));
}
export function RoleDock({role,pathname,onMore,moreOpen=false}:{role:DockRole;pathname:string;onMore:()=>void;moreOpen?:boolean}){
 return <nav className="role-dock" aria-label="Áreas principais">
  <div className={"role-dock-track role-dock-count-"+(sections[role].length+1)}>
   {sections[role].map(item=>{
    const active=current(pathname,item),Icon=item.icon;
    return <Link href={item.href} key={item.href} title={item.label} aria-current={active?'page':undefined}
      className={['role-dock-item',active?'is-active':'',item.featured?'is-featured':''].filter(Boolean).join(' ')}>
     <span className="role-dock-icon"><Icon size={item.featured?25:23} strokeWidth={active?2.4:2} aria-hidden="true"/></span>
     <span className="role-dock-label">{item.label}</span>
    </Link>;
   })}
   <button className={'role-dock-item role-dock-more'+(moreOpen?' is-active':'')} type="button"
    aria-label="Abrir todas as funções" aria-expanded={moreOpen} aria-controls="role-dock-more-panel"
    onClick={onMore} title="Mais funções">
    <span className="role-dock-icon"><MoreHorizontal size={25} aria-hidden="true"/></span>
    <span className="role-dock-label">Mais</span>
   </button>
  </div>
 </nav>
}
