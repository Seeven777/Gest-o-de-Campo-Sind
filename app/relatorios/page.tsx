'use client';
import {useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {Download,BarChart3,Route,CheckCheck,Wallet,ChevronDown} from 'lucide-react';

type Row={campaign:string;start_date:string;end_date:string;routes:number;planned_visits:number;completed_visits:number;costs:number};
const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');
const money=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function Relatorios(){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[expanded,setExpanded]=useState(false);
 useEffect(()=>{let live=true;fetch('/api/relatorios',{cache:'no-store'}).then(async r=>{
  const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao consultar relatórios.');return d;
 }).then(d=>{if(live){setRows(d.items||[]);setError('')}})
 .catch(e=>{if(live)setError(e instanceof Error?e.message:'Relatórios indisponíveis.')})
 .finally(()=>{if(live)setLoading(false)});
 return()=>{live=false}},[]);
 const totals=rows.reduce((sum,r)=>({
  routes:sum.routes+Number(r.routes||0),
  planned:sum.planned+Number(r.planned_visits||0),
  done:sum.done+Number(r.completed_visits||0),
  costs:sum.costs+Number(r.costs||0)
 }),{routes:0,planned:0,done:0,costs:0});
 return <Portal title="Relatórios" subtitle="Visão consolidada dos registros de campo." action={
  <a className="button" href="/api/relatorios?format=csv"><Download size={17}/> Exportar CSV</a>
 }>
  {error&&<p className="error" role="alert">{error}</p>}
  <section className="ops-report-summary" aria-label="Resumo de registros">
   <div><span><Route size={18}/> Rotas</span><strong>{loading?'—':fmt(totals.routes)}</strong></div>
   <div><span><BarChart3 size={18}/> Paradas previstas</span><strong>{loading?'—':fmt(totals.planned)}</strong></div>
   <div><span><CheckCheck size={18}/> Visitas finalizadas</span><strong>{loading?'—':fmt(totals.done)}</strong></div>
   <div><span><Wallet size={18}/> Despesas aprovadas/pagas*</span><strong>{loading?'—':money(totals.costs)}</strong></div>
  </section>
  <section className="panel ops-report-panel">
   <div className="panel-title"><div><small>DETALHAMENTO</small><h2>Resultados por campanha</h2></div>
    <button className="button secondary" type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
     {expanded?'Ocultar tabela':'Ver tabela'} <ChevronDown size={16}/>
    </button></div>
   <p className="muted">Os totais são calculados apenas sobre os registros retornados. *Despesas aprovadas ou informadas como pagas não equivalem necessariamente a valores efetivamente pagos.</p>
   {expanded&&<div className="tablewrap"><table><thead><tr><th>Campanha</th><th>Rotas</th><th>Paradas</th><th>Visitas finalizadas</th><th>Custo aprovado/pago</th></tr></thead><tbody>
    {rows.map((r,i)=><tr key={i}><td><strong>{r.campaign}</strong></td><td>{fmt(r.routes)}</td><td>{fmt(r.planned_visits)}</td><td>{fmt(r.completed_visits)}</td><td>{money(r.costs)}</td></tr>)}
    {!rows.length&&<tr><td colSpan={5}>{loading?'Carregando relatórios...':'Sem campanhas registradas.'}</td></tr>}
   </tbody></table></div>}
  </section>
 </Portal>;
}
