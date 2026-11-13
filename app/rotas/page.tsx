'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Portal} from '@/components/portal';
import {Route as RouteIcon,Plus,Search,ChevronLeft,ChevronRight,CalendarDays,UserRound,MapPin,ArrowRight,Layers,Send} from 'lucide-react';
import './rotas.css';
import {RouteProximityPanel,type NearbyCompany} from '@/components/route-proximity-panel';
import {RouteChosenList} from '@/components/route-chosen-list';
type RouteRow={id:string;route_date:string;campaign_name:string;agent_name:string;status:string;stops:number};
type Pick={id:string;name:string};
type Company={id:string;legal_name:string;trade_name?:string|null;city:string|null;cnpj?:string};
const states:Record<string,string>={draft:'A publicar',published:'Disponível',in_progress:'Em campo',completed:'Concluída',cancelled:'Cancelada'};
const dateLabel=(value:string)=>{const raw=String(value).slice(0,10);return raw.split('-').reverse().join('/')};
const defaultDate=()=>new Date().toLocaleDateString('sv-SE');
export default function Rotas(){
 const [rows,setRows]=useState<RouteRow[]>([]),[agents,setAgents]=useState<Pick[]>([]),[companies,setCompanies]=useState<Company[]>([]);
 const [role,setRole]=useState<'admin'|'supervisor'|'agent'|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [showForm,setShowForm]=useState(false),[filter,setFilter]=useState('all'),[agent,setAgent]=useState(''),[date,setDate]=useState(defaultDate);
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false);
 const [selected,setSelected]=useState<string[]>([]),[selectedNames,setSelectedNames]=useState<Record<string,string>>({});
 const canPlan=role==='admin'||role==='supervisor';
 async function reload(){const res=await fetch('/api/rotas',{cache:'no-store'});const payload=await res.json();if(!res.ok)throw Error(payload.error||'Falha ao carregar rotas');setRows(payload.items||[])}
 useEffect(()=>{let live=true;
  (async()=>{try{
   const [me,routes]=await Promise.all([fetch('/api/me',{cache:'no-store'}),fetch('/api/rotas',{cache:'no-store'})]);
   const user=await me.json();const list=await routes.json();
   if(!me.ok||!user.user?.role)throw Error('Faça login novamente.');
   if(!routes.ok)throw Error(list.error||'Rotas indisponíveis.');
   if(!live)return;setRole(user.user.role);setRows(list.items||[]);
   if(user.user.role==='agent')return;
   const [people,company]=await Promise.all([fetch('/api/equipe',{cache:'no-store'}),fetch('/api/companies?page=1',{cache:'no-store'})]);
   const [pd,cd]=await Promise.all([people.json(),company.json()]);
   if(!people.ok||!company.ok)throw Error(pd.error||cd.error||'Falha ao carregar opções.');
   if(!live)return;setAgents((pd.items||[]).map((x:{id:string;full_name:string})=>({id:x.id,name:x.full_name})));
   setCompanies(cd.items||[]);setHasMore(Boolean(cd.hasMore));
  }catch(e){if(live)setError(e instanceof Error?e.message:'Falha ao abrir as rotas')}
  finally{if(live)setLoading(false)}})();
  return()=>{live=false};
 },[]);
 async function findCompanies(nextPage=1){
  setError('');const res=await fetch('/api/companies?'+new URLSearchParams({q:search,page:String(nextPage)}).toString(),{cache:'no-store'});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Falha na busca');
  setCompanies(data.items||[]);setHasMore(Boolean(data.hasMore));setPage(nextPage);
 }
 function toggle(company:Company){
  setSelected(previous=>{
   if(previous.includes(company.id))return previous.filter(id=>id!==company.id);
   if(previous.length>=49)return previous;
   setSelectedNames(names=>({...names,[company.id]:(company.trade_name||company.legal_name)}));
   return [...previous,company.id];
  });
 }
 const moveSelected=(index:number,direction:-1|1)=>setSelected(previous=>{
  const next=[...previous],at=index+direction;if(at<0||at>=next.length)return previous;
  [next[index],next[at]]=[next[at],next[index]];return next;
 });
 const addNearby=(company:NearbyCompany)=>{
  setSelectedNames(names=>({...names,[company.id]:company.trade_name||company.legal_name}));
  setSelected(previous=>previous.includes(company.id)||previous.length>=49?previous:[...previous,company.id]);
 };
 async function create(e:React.FormEvent){
  e.preventDefault();if(!agent||!selected.length||!date)return;
  setBusy(true);setError('');setMessage('');
  try{
   const res=await fetch('/api/rotas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent_id:agent,date,establishment_ids:selected})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível criar');
   setMessage('Rota criada com '+data.count+' empresas. Publique-a quando estiver pronta para a equipe.');
   setSelected([]);setSelectedNames({});setShowForm(false);await reload();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao criar a rota')}finally{setBusy(false)}
 }
 async function publish(id:string){
  setBusy(true);setError('');setMessage('');
  try{
   const request=async (territoryConfirmed=false,editToken?:string)=>{
    const response=await fetch('/api/rotas',{method:'PATCH',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({id,territory_confirmed:territoryConfirmed,edit_token:editToken}),
     cache:'no-store'});
    const payload=await response.json() as {ok?:boolean;error?:string;requires_confirmation?:boolean;edit_token?:string;
     assessment?:{risk:string;coverage:number;warnings:string[];cities:{city:string}[];selected:number}};
    return {response,payload};
   };
   let {response,payload}=await request();
   if(response.status===409&&payload.requires_confirmation&&payload.assessment){
    const warnings=payload.assessment.warnings.length?payload.assessment.warnings.join('\n'):
     'Confira a concentração geográfica e a capacidade de atendimento.';
    const confirmed=window.confirm('Revisão territorial antes da publicação:\n\n'+warnings+
     '\n\n'+payload.assessment.selected+' empresas · '+
     payload.assessment.coverage+'% com coordenadas.\n\nConfirma a publicação desta versão da rota?');
    if(!confirmed)return;
    ({response,payload}=await request(true,payload.edit_token));
   }
   if(!response.ok||payload.ok!==true)throw Error(payload.error||'Não foi possível publicar a rota.');
   setMessage('Rota publicada com conferência territorial registrada. O agente já pode iniciar a jornada.');
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao publicar')}
  finally{setBusy(false)}
 }
 const visible=useMemo(()=>rows.filter(r=>filter==='all'||filter==='active'&&['published','in_progress'].includes(r.status)||filter===r.status),[rows,filter]);
 const active=rows.filter(r=>['published','in_progress'].includes(r.status)).length,drafts=rows.filter(r=>r.status==='draft').length,done=rows.filter(r=>r.status==='completed').length;
 return <Portal title="Rotas" subtitle={canPlan?'Organize as empresas, atribua um responsável e acompanhe o trabalho.':'Suas jornadas de campo, em ordem de prioridade.'}>
  <div className="routes-shell">
   <div className="routes-summary">
    <div><span>Rotas em campo ou disponíveis</span><strong>{active}</strong></div>
    <div><span>Aguardando publicação</span><strong>{drafts}</strong></div>
    <div><span>Finalizadas</span><strong>{done}</strong></div>
   </div>
   {error&&<p className="error" role="alert">{error}</p>}
   {message&&<p className="success" role="status">{message}</p>}
   {canPlan&&<section className="routes-builder">
    <div className="routes-section-top"><div><span>PLANEJAMENTO SIMPLES</span><h2>Nova rota de captação</h2><p>Escolha quem irá visitar, a data e até 49 empresas. Não é necessário criar uma campanha antes.</p></div>
     <button className="routes-primary-action" type="button" onClick={()=>setShowForm(x=>!x)} aria-expanded={showForm}>
      <Plus size={20}/>{showForm?'Fechar planejamento':'Criar rota'}</button>
    </div>
    {showForm&&<form onSubmit={create} className="routes-form">
     <div className="routes-form-top">
      <label><UserRound size={17}/> Responsável
       <select required value={agent} onChange={e=>setAgent(e.target.value)}><option value="">Selecione um agente</option>{agents.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>
      </label>
      <label><CalendarDays size={17}/> Data
       <input type="date" required value={date} onChange={e=>setDate(e.target.value)}/>
      </label>
     </div>
     <div className="routes-company-heading"><div><strong>Selecione as empresas</strong><p>Pesquise pelo nome, CNPJ ou município. A seleção fica salva ao trocar de página.</p></div><span>{selected.length} / 49</span></div>
     <div className="routes-search"><Search size={18}/><input aria-label="Buscar empresa" value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Nome, CNPJ ou município"/><button type="button" onClick={()=>{setSearch(searchInput);void (async()=>{try{const res=await fetch('/api/companies?'+new URLSearchParams({q:searchInput,page:'1'}),{cache:'no-store'});const d=await res.json();if(!res.ok)throw Error(d.error);setCompanies(d.items||[]);setHasMore(Boolean(d.hasMore));setPage(1)}catch(e){setError(e instanceof Error?e.message:'Falha na busca')}})()}}>Buscar</button></div>
     <div className="routes-company-choices">{companies.map(company=><label key={company.id} className={selected.includes(company.id)?'is-selected':''}>
      <input type="checkbox" checked={selected.includes(company.id)} disabled={!selected.includes(company.id)&&selected.length>=49} onChange={()=>toggle(company)}/>
      <span><strong>{company.trade_name||company.legal_name}</strong><small>{company.city||'Município não informado'} {company.cnpj?'· '+company.cnpj:''}</small></span>
     </label>)}
     {!companies.length&&<p className="routes-empty">Nenhuma empresa encontrada. Experimente outra busca.</p>}</div>
     <div className="routes-pagination"><button type="button" disabled={page===1} onClick={()=>void findCompanies(page-1).catch(e=>setError(e.message))}><ChevronLeft size={17}/> Anterior</button><span>Página {page}</span><button type="button" disabled={!hasMore} onClick={()=>void findCompanies(page+1).catch(e=>setError(e.message))}>Próxima <ChevronRight size={17}/></button></div>
     <RouteChosenList ids={selected} names={selectedNames} onMove={moveSelected}
      onRemove={id=>setSelected(previous=>previous.filter(x=>x!==id))}/>
     <RouteProximityPanel selectedIds={selected} date={date} onAdd={addNearby}/>
     <p className="routes-proximity-disclaimer">Confira a proximidade antes de salvar. A nova rota será criada em rascunho; a publicação exige outra confirmação.</p>
     <button className="routes-create" disabled={busy||!selected.length||!agent||!date} type="submit"><RouteIcon size={19}/>{busy?'Salvando rota...':'Criar rota com '+selected.length+' empresa(s)'}<ArrowRight size={20}/></button>
    </form>}
   </section>}
   <section className="routes-list-section">
    <div className="routes-section-top"><div><span>ACOMPANHAMENTO</span><h2>{role==='agent'?'Minhas rotas':'Rotas cadastradas'}</h2><p>Abra uma rota para visualizar empresas e trajeto.</p></div></div>
    <div className="routes-filters" role="group" aria-label="Filtrar rotas">
     {([['all','Todas'],['active','Em campo'],['draft','A publicar'],['completed','Concluídas']] as [string,string][]).filter(x=>role!=='agent'||x[0]!=='draft').map(([key,label])=><button type="button" aria-pressed={filter===key} className={filter===key?'active':''} key={key} onClick={()=>setFilter(key)}>{label}</button>)}
    </div>
    <div className="routes-cards">{visible.map(r=><article key={r.id} className="routes-item">
     <div className="routes-item-icon"><RouteIcon size={22}/></div>
     <div className="routes-item-content">
      <div><strong>Rota de {dateLabel(r.route_date)}</strong><span className={'routes-state routes-state-'+r.status}>{states[r.status]||r.status}</span></div>
      <p><UserRound size={15}/>{r.agent_name}<span>·</span><MapPin size={15}/>{r.stops} {r.stops===1?'empresa':'empresas'}</p>
     </div>
     <div className="routes-item-actions">
      {canPlan&&r.status==='draft'&&<button type="button" className="routes-publish" disabled={busy} onClick={()=>void publish(r.id)}><Send size={16}/> Publicar</button>}
      <Link href={(role==='agent'?'/campo/':'/rotas/')+r.id} className="routes-open">{role==='agent'?'Abrir jornada':'Ver percurso e editar'}<ChevronRight size={17}/></Link>
     </div>
    </article>)}
     {!visible.length&&<div className="routes-empty"><Layers size={29}/><strong>{loading?'Carregando rotas...':'Nenhuma rota neste filtro'}</strong><p>{role==='agent'?'Sua equipe visualizará as rotas aqui quando forem publicadas.':'Crie uma rota ou selecione outro filtro.'}</p></div>}
    </div>
   </section>
  </div>
 </Portal>;
}
