import type {ReactNode} from 'react';

type AuthShellProps={
 eyebrow:string;
 title:string;
 description:string;
 children:ReactNode;
 footer?:ReactNode;
};
export function AuthShell({
 eyebrow,title,description,children,
 footer
}:AuthShellProps){
 const variant=eyebrow==='ACESSO À ÁREA INTERNA'?'login':
  eyebrow==='SOLICITAÇÃO DE ACESSO'?'access':
  eyebrow==='SEGURANÇA DA CONTA'?'recovery':'standard';
 return <main className={'auth-page auth-page-'+variant}>
  <div className="auth-hero" role="img" aria-label="Profissionais de pet shop com cães e gato em um ambiente acolhedor"/>
  <div className="auth-dark-base" aria-hidden="true"/>
  <section className="auth-panel" aria-labelledby="auth-title">
   <div className="auth-panel-inner">
    <div className="auth-main">
     <header className="auth-intro">
      <span className="auth-section-label">{eyebrow}</span>
      <h1 id="auth-title">{title}</h1>
      <p>{description}</p>
     </header>
     {children}
     {footer}
    </div>
   </div>
  </section>
  <div className="auth-signature" aria-label="SindPetshop-SP, cuidando de você">Sindpetshop-SP cuidando de você</div>
 </main>;
}
