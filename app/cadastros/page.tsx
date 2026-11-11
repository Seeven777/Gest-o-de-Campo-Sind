'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {Portal} from '@/components/portal';
import {Search,ShieldCheck,Building2} from 'lucide-react';
type Company={id:string;cnpj:string;legal_name:string;trade_name:string|null;city:string|null;registration_state:string;reference:string|null;confirmed_at:string|null};
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'—';
export default function Cadastros(){
 const [term,setTerm]=useState(''),[query,setQuery]=useState(''),[items,setItems]=useState<Company[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');
  fetch('/api/cadastros?q='+encodeURIComponent(query),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao consultar');if(active)setItems(d.items||[])})
   .catch(e=>{if(active){setItems([]);setError(e instanceof Error?e.message:'Não foi possível consultar os registros')}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[query]);
 return <Portal title="Cadastros sindicais" subtitle="Somente empresas validadas e com cadastro sindical confirmado.">
  <section className="panel" style={{maxWidth:1150,margin:'0 auto'}}>
   <div className="panel-title"><div><small>REGISTROS CONFIRMADOS</small><h2>Empresas cadastradas</h2></div><ShieldCheck size={25} color="#27734d"/></div>
   <p className="muted">Esta lista não inclui empresas apenas captadas, pendentes de validação ou sem confirmação administrativa. Para confirmar um novo cadastro, acesse Empresas.</p>
   <form className="toolbar" onSubmit={(e:FormEvent)=>{e.preventDefault();setQuery(term)}}>
    <input aria-label="Buscar cadastros confirmados" className="field" style={{flex:1,minWidth:180}} placeholder="Buscar CNPJ, empresa ou cidade" value={term} onChange={e=>setTerm(e.target.value)}/>
    <button className="button secondary"><Search size={17}/> Buscar</button>
   </form>
   {error&&<p role="alert" className="error">{error}</p>}
   <div className="tablewrap"><table><thead><tr><th>Empresa</th><th>Cidade</th><th>Cadastro</th><th>Referência administrativa</th></tr></thead>
    <tbody>{items.map(x=><tr key={x.id}>
     <td><strong>{x.trade_name||x.legal_name}</strong><small style={{display:'block'}}>{x.cnpj}</small></td>
     <td>{x.city||'Não informado'}</td>
     <td><span className="pill">Confirmado</span><small style={{display:'block',marginTop:5}}>{date(x.confirmed_at)}</small></td>
     <td>{x.reference||'—'}</td>
    </tr>)}{!items.length&&<tr><td colSpan={4}><div className="empty"><div><Building2 size={31}/><strong>{loading?'Carregando...':'Nenhum cadastro sindical confirmado'}</strong><p>{query?'Tente outra busca.':'Os registros aparecerão após validação em campo e confirmação administrativa.'}</p></div></div></td></tr>}</tbody>
   </table></div>
  </section>
 </Portal>;
}
