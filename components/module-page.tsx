import Link from 'next/link';
import {Portal} from '@/components/portal';
import {ArrowRight,Compass,Layers3} from 'lucide-react';
export default function ModulePage({title,desc,steps}:{title:string;desc:string;steps:string[]}){
 return <Portal title={title} subtitle={desc}><div className="module-layout"><section className="module-hero"><span className="chip-soft"><Layers3 size={15}/> Evolução planejada</span><h2>Uma operação mais simples começa aqui.</h2><p>Este módulo já faz parte da navegação, mas suas operações serão implementadas na próxima etapa. Não há dados de demonstração fingindo ser dados reais.</p><Link href="/dashboard" className="button white">Voltar à visão geral <ArrowRight size={16}/></Link><div className="module-decor"><Compass size={166} strokeWidth={.6}/></div></section><section className="panel module-roadmap"><div className="panel-title"><div><small>O QUE ESTÁ PREVISTO</small><h3>Próximas capacidades</h3></div></div><div className="roadmap-list">{steps.map((s,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{s}</p></div>)}</div></section></div></Portal>
}
