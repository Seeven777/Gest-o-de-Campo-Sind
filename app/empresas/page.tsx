'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Building2,ChevronDown,ChevronLeft,ChevronRight,FileUp,Search,ShieldCheck,SlidersHorizontal,X} from 'lucide-react';
import {Portal} from '@/components/portal';
import {StudioPageBanner} from '@/components/studio-page-banner';

type Company={id:string;cnpj:string;legal_name:string;trade_name:string|null;city:string|null;state:string|null;field_status:string;registration_state:string};
const pretty=(s:string)=>s?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
const statusNames:Record<string,string>={pending:'A visitar',validated:'Validada',review:'Em análise',invalid:'Inconsistente'};

export default function Empresas(){
 const [items,setItems]=useState<Company[]>([]),[city,setCity]=useState(''),[cnae,setCnae]=useState(''),[status,setStatus]=useState('');
 const [filters,setFilters]=useState({city:'',cnae:'',status:''}),[term,setTerm]=useState(''),[q,setQ]=useState('');
 const [advanced,setAdvanced]=useState(false),[page,setPage]=useState(1),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[canImport,setCanImport]=useState(false);
 useEffect(()=>{
  let active=true;setLoading(true);
  fetch('/api/companies?'+new URLSearchParams({q,page:String(page),...filters}),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível consultar empresas.');return d;})
   .then(d=>{if(active){setItems(d.items||[]);setMore(Boolean(d.hasMore));setError('')}})
   .catch(e=>{if(active){setItems([]);setMore(false);setError(e instanceof Error?e.message:'Falha ao consultar empresas.')}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[q,page,filters]);
 useEffect(()=>{let alive=true;fetch('/api/me',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(alive)setCanImport(['admin','supervisor'].includes(d?.user?.role))}).catch(()=>{if(alive)setCanImport(false)});return()=>{alive=false}},[]);
 const apply=(e:FormEvent)=>{e.preventDefault();setPage(1);setQ(term);setFilters({city,cnae,status})};
 const hasFilters=Boolean(filters.city||filters.cnae||filters.status);
 const clear=()=>{setCity('');setCnae('');setStatus('');setTerm('');setPage(1);setQ('');setFilters({city:'',cnae:'',status:''})};
 return <Portal title="Empresas" subtitle="Empresas da base operacional, da visita até a confirmação sindical." action={canImport?<Link href="/importacoes" className="button"><FileUp size={16}/> Importar</Link>:undefined}>
  <StudioPageBanner eyebrow="BASE OPERACIONAL" title="Encontre. Avalie. Acompanhe." description="Uma busca direta para localizar empresas e consultar a situação em campo." icon={Building2}/>
  <section className="panel">
   <div className="panel-title"><div><small>BASE OPERACIONAL</small><h2>Encontre uma empresa</h2></div><Building2 size={22} color="#e36e29"/></div>
   <form className="toolbar ops-companies-search" onSubmit={apply}>
    <div style={{display:'flex',alignItems:'center',flex:1,position:'relative'}}>
     <Search size={18} style={{position:'absolute',left:14,color:'#9a693c'}}/>
     <input aria-label="Buscar empresas" className="field" value={term} onChange={e=>setTerm(e.target.value)}
      style={{paddingLeft:42,width:'100%'}} placeholder="Empresa, CNPJ ou município"/>
    </div>
    <button type="submit" className="button">Buscar</button>
    <button type="button" className="button secondary ops-filter-toggle" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced} aria-controls="ops-company-filters"><SlidersHorizontal size={16}/> Filtros {hasFilters?'ativos':''}<ChevronDown size={15}/></button>
    {(hasFilters||q)&&<button type="button" className="ops-clear" onClick={clear} aria-label="Limpar busca e filtros"><X size={16}/> Limpar</button>}
    {advanced&&<div id="ops-company-filters" className="ops-company-filters">
     <input className="field" style={{flex:'1 1 145px'}} placeholder="Município" value={city} onChange={e=>setCity(e.target.value)}/>
     <input className="field" style={{flex:'1 1 110px'}} placeholder="CNAE" inputMode="numeric" value={cnae} onChange={e=>setCnae(e.target.value.replace(/\D/g,''))}/>
     <select className="field" aria-label="Filtrar situação de campo" style={{flex:'1 1 160px'}} value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="">Todas as situações</option><option value="pending">A visitar</option><option value="validated">Validada</option>
      <option value="review">Em análise</option><option value="invalid">Inconsistente</option>
     </select>
     <button className="button secondary" type="submit">Aplicar filtros</button>
    </div>}
   </form>
   <p className="ops-results-caption" aria-live="polite">{loading?'Consultando empresas...':items.length+' empresas nesta página'}{hasFilters?' · Filtros aplicados':''}</p>
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="tablewrap ops-company-table"><table><thead><tr><th>Empresa</th><th className="ops-detail-cell">CNPJ</th><th>Município</th><th>Campo</th><th className="ops-detail-cell">Cadastro sindical</th></tr></thead>
    <tbody>{items.map(e=><tr key={e.id}>
     <td><strong>{e.trade_name||e.legal_name}</strong>{e.trade_name&&<small style={{display:'block'}}>{e.legal_name}</small>}<details className="ops-mobile-details"><summary>Ver CNPJ e cadastro</summary><p>CNPJ: {pretty(e.cnpj)}</p><p>Cadastro: {e.registration_state==='confirmed'?'Confirmado':e.registration_state==='unavailable'?'Conferência indisponível':'Não confirmado'}</p></details></td>
     <td className="ops-detail-cell">{pretty(e.cnpj)}</td><td>{e.city||'Não informado'}{e.state?' / '+e.state:''}</td>
     <td><span className={'pill'+(e.field_status==='validated'?'':' warn')}>{statusNames[e.field_status]||e.field_status}</span></td>
     <td className="ops-detail-cell">{e.registration_state==='confirmed'?<span className="pill"><ShieldCheck size={14}/> Confirmado</span>:e.registration_state==='unavailable'?<span className="muted">Conferência pendente de configuração</span>:<span className="muted">Não confirmado</span>}</td>
    </tr>)}
    {!items.length&&<tr><td colSpan={5}><div className="empty"><div><Building2 size={32} color="#d8732b"/>
     <strong>{loading?'Carregando empresas...':'Nenhuma empresa encontrada'}</strong><p>Experimente outros filtros.</p>
    </div></div></td></tr>}</tbody>
   </table></div>
   <p className="ops-results-note">Validação de campo e confirmação sindical são etapas diferentes.</p>
   <div className="pagination">
    <button className="button secondary" aria-label="Página anterior" disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}><ChevronLeft size={15}/></button>
    <span>Página {page}</span>
    <button className="button secondary" aria-label="Próxima página" disabled={!more||loading} onClick={()=>setPage(x=>x+1)}><ChevronRight size={15}/></button>
   </div>
  </section>
 </Portal>;
}
