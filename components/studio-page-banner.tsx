'use client';
import type {ReactNode} from 'react';
import {ArrowUpRight, type LucideIcon} from 'lucide-react';

/** Introdução compacta e consistente entre cargos, sem interferir na operação. */
export function StudioPageBanner({
 eyebrow,title,description,icon:Icon,aside
}:{
 eyebrow:string;title:string;description:string;icon:LucideIcon;aside?:ReactNode
}){
 return <section className="studio-page-banner" aria-label={title}>
  <span className="studio-banner-halo" aria-hidden="true"/>
  <div className="studio-banner-main">
   <span className="studio-banner-eyebrow"><span className="studio-banner-live"/> {eyebrow}</span>
   <h2>{title}</h2>
   <p>{description}</p>
  </div>
  <div className="studio-banner-side" aria-hidden={aside?undefined:true}>
   {aside||<span className="studio-banner-symbol"><Icon size={28} strokeWidth={1.5}/><ArrowUpRight size={15} className="studio-banner-mini"/></span>}
  </div>
 </section>;
}
