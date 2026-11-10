'use client';
import {useState,type FormEvent} from 'react';
import {Portal} from '@/components/portal';
import {Search,Database,CheckCircle2,ArrowDownToLine} from 'lucide-react';
type Company={cnpj:string;legal_name:string;trade_name:string;city:string;state:string;main_cnae:string;type:string;already_in_field:boolean;field_status?:string};
export default function Catalogo(){
 const [cnae,setCnae]=useState(''),[city,setCity]=useState(''),[state,setState]=useState('SP'),[type,setType]=useState(''),[q,setQ]=useState('');
 const [items,setItems]=useState<Company[]>([]),[lastFilters,setLastFilters]=useState<Record<string,string>>({}),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function search(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');setSelected([]);
 try{const p=new URLSearchParams({cnae,city,state,type,q});const r=await fetch('/api/catalogo?'+p.toString(),{cache:'no-store'});const d=await r.json();if(!r.ok||!d.configured)throw Error(d.error||'Catálogo não configurado');setItems(d.items||[]);setLastFilters({cnae,city,state,type,q})}
 catch(e){setError(e instanceof Error?e.message:'Erro na consulta')}finally{setBusy(false)}}
 async function add(){setBusy(true);setError('');setNotice('');
 try{const r=await fetch('/api/catalogo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cnpjs:selected,filters:lastFilters})});const d=await r.json();if(!r.ok)throw Error(d.error);setNotice(`${d.added} empresas incluídas na operação; ${d.existing} já existiam; ${d.invalid} inválidas.`);setSelected([]);setItems(prev=>prev.map(x=>({...x,already_in_field:x.already_in_field||selected.includes(x.cnpj)})))}catch(e){setError(e instanceof Error?e.message:'Falha na seleção')}finally{setBusy(false)}}
 const fresh=items.filter(x=>!x.already_in_field);
 return <Portal title="Catálogo de empresas" subtitle="Pesquise na ferramenta externa e selecione somente o que entrará no trabalho de campo.">
 <section className="panel"><div className="panel-title"><div><small>FONTE EXTERNA</small><h2>Buscar oportunidades por território e atividade</h2></div><Database size={21}/></div>
 <form onSubmit={search} className="form-grid">
 <label>CNAE<input className="field" value={cnae} onChange={e=>setCnae(e.target.value)} placeholder="Ex.: 7500100"/></label>
 <label>Município<input className="field" value={city} onChange={e=>setCity(e.target.value)} placeholder="Ex.: Guarulhos"/></label>
 <label>UF<input className="field" maxLength={2} value={state} onChange={e=>setState(e.target.value.toUpperCase())}/></label>
 <label>Tipo / porte<input className="field" value={type} onChange={e=>setType(e.target.value)} placeholder="Ex.: ME, EPP"/></label>
 <label style={{gridColumn:'1/-1'}}>Nome, CNPJ ou termo<input className="field" value={q} onChange={e=>setQ(e.target.value)}/></label>
 <button className="button" disabled={busy}><Search size={16}/> {busy?'Buscando...':'Consultar catálogo'}</button>
 </form><p className="muted" style={{marginTop:15}}>A pesquisa não cadastra automaticamente empresas. O histórico das 1.848 importadas permanece intacto.</p>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
 </section>
 <section className="panel" style={{marginTop:18}}><div className="panel-title"><div><small>RESULTADOS</small><h2>{items.length} estabelecimentos encontrados nesta página</h2></div><button className="button" disabled={busy||!selected.length} onClick={add}><ArrowDownToLine size={16}/> Incluir {selected.length} na operação</button></div>
 <div className="tablewrap"><table><thead><tr><th>Selecionar</th><th>Empresa</th><th>CNPJ</th><th>Município</th><th>CNAE</th><th>Situação</th></tr></thead><tbody>
 {items.map(x=><tr key={x.cnpj}><td><input type="checkbox" aria-label={'Selecionar '+x.legal_name} disabled={x.already_in_field} checked={selected.includes(x.cnpj)} onChange={e=>setSelected(s=>e.target.checked?[...s,x.cnpj]:s.filter(c=>c!==x.cnpj))}/></td><td><strong>{x.trade_name||x.legal_name}</strong><small style={{display:'block'}}>{x.trade_name?x.legal_name:''}</small></td><td>{x.cnpj}</td><td>{x.city} / {x.state}</td><td>{x.main_cnae||'—'}</td><td>{x.already_in_field?<span className="pill"><CheckCircle2 size={12}/> Já na operação</span>:<span className="pill warn">Disponível</span>}</td></tr>)}
 {!items.length&&<tr><td colSpan={6}><div className="empty"><div><Database size={26}/><strong>Nenhuma consulta realizada</strong><p>Defina filtros e busque na base externa.</p></div></div></td></tr>}
 </tbody></table></div><p className="muted" style={{marginTop:14}}>{fresh.length} empresas disponíveis para seleção. A verificação usa o CNPJ completo.</p></section>
 </Portal>}
