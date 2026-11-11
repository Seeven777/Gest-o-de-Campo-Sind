'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Portal} from '@/components/portal';
import {CalendarDays,ChevronRight,Navigation,Wallet,MapPin,CheckCircle2} from 'lucide-react';
import '../campo/jornada.css';
type AssignedRoute={id:string;route_date:string;status:string;campaign_name:string;stops:number};
const label=(s:string)=>s==='in_progress'?'Em andamento':s==='published'?'Disponível':s==='completed'?'Concluída':'Rota';
export default function Agent(){
 const [routes,setRoutes]=useState<AssignedRoute[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;
  fetch('/api/rotas',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível consultar sua agenda.');if(active)setRoutes(d.items||[])})
  .catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao carregar a agenda.')})
  .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const ordered=useMemo(()=>[...routes].sort((a,b)=>{
  const priority=(s:string)=>s==='in_progress'?0:s==='published'?1:2;
  const diff=priority(a.status)-priority(b.status);if(diff!==0)return diff;
  return a.route_date.localeCompare(b.route_date);
 }),[routes]);
 const next=ordered.find(r=>r.status==='published'||r.status==='in_progress');
 const upcoming=ordered.filter(r=>r.id!==next?.id&&r.status!=='completed').slice(0,5);
 return <Portal title="Meu dia em campo" subtitle="Sua próxima tarefa está aqui. Abra a próxima rota e acompanhe o trajeto no mapa.">
 <div className="field-guide">
 {error&&<p className="field-error" role="alert">{error}</p>}
 {loading?<section className="field-stage"><strong>Carregando sua agenda...</strong></section>:
 next?<section className="field-stage">
 <span className="field-step">PRÓXIMA ROTA</span>
 <h2>{next.campaign_name}</h2>
 <p className="field-muted"><CalendarDays size={18} style={{verticalAlign:'middle',marginRight:8}}/>{String(next.route_date).slice(0,10).split('-').reverse().join('/')} · {label(next.status)}</p>
 <div className="field-big-number">{next.stops} <span>empresas na rota</span></div>
 <p>Você verá cada endereço no mapa. Ao chegar, o aplicativo solicitará uma foto e algumas respostas simples.</p>
 <Link href={'/campo/'+next.id} className="field-primary" style={{textDecoration:'none'}}><Navigation size={25}/> {next.status==='in_progress'?'Continuar minha jornada':'Iniciar minha jornada'} <ChevronRight size={23}/></Link>
 </section>:
 <section className="field-stage"><div className="field-step">MINHAS ROTAS</div><MapPin size={44} color="#658773"/><h2>Nenhuma jornada disponível</h2><p>Quando a administração publicar uma rota para você, ela aparecerá aqui automaticamente.</p></section>}
 {upcoming.length>0&&<section className="field-stage"><span className="field-step">OUTRAS ROTAS ATRIBUÍDAS</span><h2>Próximas jornadas</h2>
 <div style={{display:'grid',gap:12}}>{upcoming.map(r=><Link href={'/campo/'+r.id} key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,border:'2px solid #dce9df',padding:17,borderRadius:14,color:'#18392b',textDecoration:'none',minHeight:64}}>
 <div><strong style={{fontSize:19}}>{r.campaign_name}</strong><small style={{display:'block',fontSize:14,color:'#658071'}}>{r.stops} empresas · {String(r.route_date).slice(0,10).split('-').reverse().join('/')}</small></div><ChevronRight size={23}/></Link>)}</div></section>}
 <section className="field-stage"><span className="field-step">ACESSOS RÁPIDOS</span><div style={{display:'grid',gap:12}}>
 <Link href="/visitas" className="field-option" style={{textDecoration:'none',color:'#1b4936'}}><CheckCircle2 size={22}/> <span>Consultar minhas visitas</span><ChevronRight size={22}/></Link>
 <Link href="/reembolsos" className="field-option" style={{textDecoration:'none',color:'#1b4936'}}><Wallet size={22}/> <span>Registrar minhas despesas</span><ChevronRight size={22}/></Link>
 </div></section>
 </div>
 </Portal>;
}
