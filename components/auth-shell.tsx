import type {ReactNode} from 'react';
import {BrandMark} from '@/components/brand-mark';
import {ShieldCheck} from 'lucide-react';

type AuthShellProps={
 eyebrow:string;
 title:string;
 description:string;
 children:ReactNode;
 heroTitle?:ReactNode;
 heroDescription?:string;
 footer?:ReactNode;
};
export function AuthShell({
 eyebrow,title,description,children,
 heroTitle=<>Mais perto de quem <span>cuida.</span></>,
 heroDescription='Informação, planejamento e presença em campo para fortalecer quem trabalha no setor pet.',
 footer
}:AuthShellProps){
 return <main className="auth-page">
  <section className="auth-visual" aria-label="Profissionais e animais de um pet shop">
   <div className="auth-photo" aria-hidden="true"/>
   <div className="auth-visual-copy">
    <div className="auth-eyebrow"><span className="auth-eyebrow-dot"/> A PRESENÇA FAZ A DIFERENÇA</div>
    <h2>{heroTitle}</h2>
    <p>{heroDescription}</p>
    <div className="auth-visual-signature"><ShieldCheck size={18} aria-hidden="true"/> SindPetshop-SP · Campo &amp; Território</div>
   </div>
  </section>
  <section className="auth-panel" aria-labelledby="auth-title">
   <div className="auth-panel-inner">
    <header className="auth-brand">
     <span className="auth-brand-mark"><BrandMark size={48}/></span>
     <span className="auth-brand-text"><strong>SindPetshop<span>–SP</span></strong><small>Campo &amp; Território</small></span>
    </header>
    <div className="auth-main">
     <div className="auth-intro">
      <span className="auth-section-label">{eyebrow}</span>
      <h1 id="auth-title">{title}</h1>
      <p>{description}</p>
     </div>
     {children}
     {footer}
    </div>
    <div className="auth-panel-bottom">
     <ShieldCheck size={16} aria-hidden="true"/>
     <span>Plataforma interna do SindPetshop-SP. Acesso controlado e protegido.</span>
    </div>
   </div>
  </section>
 </main>;
}
