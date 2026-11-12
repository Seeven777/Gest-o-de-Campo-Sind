'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Building2,ChevronLeft,ChevronRight,FileUp,Search,ShieldCheck} from 'lucide-react';
import {Portal} from '@/components/portal';

type Company={id:string;cnpj:string;legal_name:string;trade_name:string|null;city:string|null;state:string|null;field_status:string;registration_state:string};
const pretty=(s:string)=>s?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
const statusNames:Record<string,string>={pending:'A visitar',validated:'Validada',review:'Em análise',invalid:'Inconsistente'};

export default function Empresas(){
 const [items,setItems]=useState<Company[]>([]),[city,setCity]=useState(''),[cnae,setCnae]=useState(''),[status,setStatus]=useState('');
 const [filters,setFilters]=useState({city:'',cnae:'',status:''}),[term,setTerm]=useState(''),[q,setQ]=useState('');
 const [page,setPage]=useState(1),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[canImport,setCanImport]=useState(false);
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
 return <Portal title="Empresas" subtitle="Empresas da base operacional, da visita até a confirmação sindical." action={canImport?<Link href="/importacoes" className="button"><FileUp size={16}/> Importar</Link>:undefined}>
  <section className="panel">
   <div className="panel-title"><div><small>BASE EMPRESARIAL</small><h2>Empresas em acompanhamento</h2></div><span className="pill">Base de trabalho</span></div>
   <p className="muted">A validação em campo não significa cadastro sindical confirmado. A equipe de Cadastro realiza a confirmação em <Link href="/cadastros" className="link-inline">Cadastros sindicais</Link>.</p>
   <form className="toolbar" onSubmit={apply}>
    <div style={{display:'flex',alignItems:'center',flex:1,position:'relative'}}>
     <Search size={18} style={{position:'absolute',left:14,color:'#9a693c'}}/>
     <input aria-label="Buscar empresas" className="field" value={term} onChange={e=>setTerm(e.target.value)}
      style={{paddingLeft:42,width:'100%'}} placeholder="Empresa, CNPJ ou município"/>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',width:'100%'}}>
     <input className="field" style={{flex:'1 1 145px'}} placeholder="Município" value={city} onChange={e=>setCity(e.target.value)}/>
     <input className="field" style={{flex:'1 1 110px'}} placeholder="CNAE" inputMode="numeric" value={cnae} onChange={e=>setCnae(e.target.value.replace(/\D/g,''))}/>
     <select className="field" aria-label="Filtrar situação de campo" style={{flex:'1 1 160px'}} value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="">Todas as situações</option><option value="pending">A visitar</option><option value="validated">Validada</option>
      <option value="review">Em análise</option><option value="invalid">Inconsistente</option>
     </select>
     <button className="button secondary" type="submit">Aplicar filtros</button>
    </div>
   </form>
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="tablewrap"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Município</th><th>Campo</th><th>Cadastro sindical</th></tr></thead>
    <tbody>{items.map(e=><tr key={e.id}>
     <td><strong>{e.trade_name||e.legal_name}</strong>{e.trade_name&&<small style={{display:'block'}}>{e.legal_name}</small>}</td>
     <td>{pretty(e.cnpj)}</td><td>{e.city||'Não informado'}{e.state?' / '+e.state:''}</td>
     <td><span className={'pill'+(e.field_status==='validated'?'':' warn')}>{statusNames[e.field_status]||e.field_status}</span></td>
     <td>{e.registration_state==='confirmed'?<span className="pill"><ShieldCheck size={14}/> Confirmado</span>:e.registration_state==='unavailable'?<span className="muted">Conferência pendente de configuração</span>:<span className="muted">Não confirmado</span>}</td>
    </tr>)}
    {!items.length&&<tr><td colSpan={5}><div className="empty"><div><Building2 size={32} color="#d8732b"/>
     <strong>{loading?'Carregando empresas...':'Nenhuma empresa encontrada'}</strong><p>Experimente outros filtros.</p>
    </div></div></td></tr>}</tbody>
   </table></div>
   <div className="pagination">
    <button className="button secondary" aria-label="Página anterior" disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}><ChevronLeft size={15}/></button>
    <span>Página {page}</span>
    <button className="button secondary" aria-label="Próxima página" disabled={!more||loading} onClick={()=>setPage(x=>x+1)}><ChevronRight size={15}/></button>
   </div>
  </section>
 </Portal>;
}
