'use client';import {useEffect,useState} from 'react';import {Portal} from '@/components/portal';import {MapPin} from 'lucide-react';
type Row={city:string;total:number;validated:number;registered:number;pending:number};
export default function Territorio(){const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState('');
useEffect(()=>{fetch('/api/territorio',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.items||[])}).catch(e=>setError(e.message))},[]);
return <Portal title="Inteligência territorial" subtitle="Compare empresas identificadas, validadas e cadastros sindicais confirmados por cidade.">
<section className="panel"><div className="panel-title"><div><small>COBERTURA MUNICIPAL</small><h2>Indicadores por município</h2></div><MapPin size={21}/></div>
<p className="muted">As duas medidas de crescimento permanecem separadas. O mapa geográfico com polígonos municipais e séries temporais será incluído após carregar a malha IBGE e normalizar os municípios.</p>
{error&&<p className="error">{error}</p>}<div className="tablewrap"><table><thead><tr><th>Município</th><th>Identificadas</th><th>Validadas</th><th>Cadastros confirmados</th><th>Aguardando campo</th></tr></thead><tbody>{rows.map(x=><tr key={x.city}><td><strong>{x.city}</strong></td><td>{x.total}</td><td>{x.validated}</td><td>{x.registered}</td><td>{x.pending}</td></tr>)}{!rows.length&&<tr><td colSpan={5}>Nenhum município na base.</td></tr>}</tbody></table></div></section></Portal>}
