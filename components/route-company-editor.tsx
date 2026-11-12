'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ChevronLeft,ChevronRight,Search,Save,ShieldAlert,X} from 'lucide-react';
import {RouteProximityPanel,type NearbyCompany} from '@/components/route-proximity-panel';
import {RouteChosenList} from '@/components/route-chosen-list';
type Stop={establishment_id:string;legal_name:string;trade_name:string|null};
type Company={id:string;legal_name:string;trade_name:string|null;city:string|null;cnpj?:string};
export function RouteCompanyEditor({routeId,date,editToken,stops,published,onCancel,onSaved}:{
 routeId:string;date:string;editToken:string;stops:Stop[];published:boolean;
 onCancel:()=>void;onSaved:()=>Promise<void>
}){
 const [ids,setIds]=useState(stops.map(s=>s.establishment_id));
 const [names,setNames]=useState<Record<string,string>>(()=>Object.fromEntries(stops.map(s=>[s.establishment_id,s.trade_name||s.legal_name])));
 const [results,setResults]=useState<Company[]>([]),[term,setTerm]=useState(''),[page,setPage]=useState(1),[more,setMore]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const changed=ids.length!==stops.length||ids.some((id,i)=>id!==stops[i].establishment_id);
 useEffect(()=>{let mounted=true;
  fetch('/api/companies?page=1',{cache:'no-store'}).then(async res=>{
   const body=await res.json();if(!res.ok)throw Error(body.error||'Falha ao consultar empresas.');return body
  }).then(body=>{if(mounted){setResults(body.items||[]);setMore(Boolean(body.hasMore))}})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Não foi possível abrir empresas.')})
   .finally(()=>{if(mounted)setLoading(false)});
  return()=>{mounted=false};
 },[]);
 const move=(index:number,dir:-1|1)=>setIds(current=>{
  const next=[...current],to=index+dir;if(to<0||to>=next.length)return current;
  [next[index],next[to]]=[next[to],next[index]];return next
 });
 const remove=(id:string)=>setIds(list=>list.filter(x=>x!==id));
 const add=(item:{id:string;legal_name:string;trade_name?:string|null})=>{
  setNames(old=>({...old,[item.id]:item.trade_name||item.legal_name}));
  setIds(old=>old.includes(item.id)||old.length>=49?old:[...old,item.id]);
 };
 const toggle=(item:Company)=>ids.includes(item.id)?remove(item.id):add(item);
 const suggestion=(item:NearbyCompany)=>add(item);
 async function search(nextPage=1,query=term){
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/companies?'+new URLSearchParams({q:query,page:String(nextPage)}),{cache:'no-store'});
   const d=await res.json();if(!res.ok)throw Error(d.error||'Falha ao buscar empresas.');
   setResults(d.items||[]);setMore(Boolean(d.hasMore));setPage(nextPage);
  }catch(e){setError(e instanceof Error?e.message:'Busca indisponível')}
  finally{setLoading(false)}
 }
 const submitSearch=(e:FormEvent)=>{e.preventDefault();void search(1)};
 async function save(){
  if(!changed||busy||ids.length===0)return;
  if(published&&!window.confirm('Esta rota já foi publicada. Ela ainda não começou, mas o agente poderá ver as mudanças ao atualizar a jornada. Confirma a edição?'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/rotas/'+encodeURIComponent(routeId),{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({establishment_ids:ids,edit_token:editToken}),cache:'no-store'
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível salvar esta rota.');
   setMessage('Alterações confirmadas. Atualizando a rota...');
   await onSaved();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar empresas.')}
  finally{setBusy(false)}
 }
 return <section className="routes-editor-card" aria-label="Editar empresas da rota">
  <div className="routes-editor-header">
   <div><h3>Editar paradas da rota</h3><p>Acrescente empresas, remova itens ou mude a ordem antes da saída do agente.</p></div>
   <button type="button" className="button secondary" onClick={onCancel} disabled={busy}><X size={16}/> Fechar</button>
  </div>
  {published&&<p className="routes-editor-note"><ShieldAlert size={17}/> A rota já foi publicada, mas ainda não foi iniciada. Ao salvar, a nova sequência ficará disponível para o responsável. A edição será bloqueada após o primeiro check-in ou início do GPS.</p>}
  <form className="routes-search" onSubmit={submitSearch}>
   <Search size={18} aria-hidden="true"/>
   <input aria-label="Pesquisar empresa para adicionar à rota" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Nome, CNPJ ou município"/>
   <button type="submit" disabled={loading}>Buscar</button>
  </form>
  <div className="routes-company-choices" aria-label="Resultados da pesquisa">
   {results.map(company=><label key={company.id} className={ids.includes(company.id)?'is-selected':''}>
    <input type="checkbox" checked={ids.includes(company.id)} disabled={!ids.includes(company.id)&&ids.length>=49||busy}
     onChange={()=>toggle(company)}/>
    <span><strong>{company.trade_name||company.legal_name}</strong><small>{company.city||'Cidade não informada'} · {company.cnpj||'CNPJ não informado'}</small></span>
   </label>)}
   {!loading&&!results.length&&<p className="routes-empty">Nenhuma empresa encontrada. Revise a busca.</p>}
   {loading&&<p className="routes-empty" role="status">Carregando opções...</p>}
  </div>
  <div className="routes-pagination">
   <button type="button" disabled={loading||page===1} onClick={()=>void search(page-1)}><ChevronLeft size={16}/> Anterior</button>
   <span>Página {page}</span>
   <button type="button" disabled={loading||!more} onClick={()=>void search(page+1)}>Próxima <ChevronRight size={16}/></button>
  </div>
  <RouteChosenList ids={ids} names={names} onMove={move} onRemove={remove}/>
  <RouteProximityPanel selectedIds={ids} date={date} routeId={routeId} onAdd={suggestion}/>
  {error&&<p className="error" role="alert">{error}</p>}
  {message&&<p className="success" role="status">{message}</p>}
  <div className="routes-editor-actions">
   <button className="routes-create" type="button" disabled={!changed||!ids.length||busy} onClick={()=>void save()}>
    <Save size={18}/>{busy?'Salvando alterações...':'Salvar '+ids.length+' paradas'}
   </button>
   <button className="button secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
  </div>
 </section>;
}
