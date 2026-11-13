'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Portal} from '@/components/portal';
import {Route as RouteIcon,Plus,Search,ChevronLeft,ChevronRight,CalendarDays,UserRound,MapPin,ArrowRight,ArrowLeft,Check,Layers,Send,Sparkles} from 'lucide-react';
import './rotas.css';
import {RouteProximityPanel,type NearbyCompany} from '@/components/route-proximity-panel';
import {RouteChosenList} from '@/components/route-chosen-list';
import {neighborhoodKey} from '@/lib/route-neighborhood';
import {addVisibleStops} from '@/lib/route-bulk-selection';
type RouteRow={id:string;route_date:string;campaign_name:string;agent_name:string;status:string;stops:number;neighborhood_label?:string};
type Pick={id:string;name:string};
type Company={id:string;legal_name:string;trade_name?:string|null;city:string|null;district:string|null;cnpj?:string};
type AreaOption={name:string;count:number};
const states:Record<string,string>={draft:'A publicar',published:'Disponível',in_progress:'Em campo',completed:'Concluída',cancelled:'Cancelada'};
const dateLabel=(value:string)=>{const raw=String(value).slice(0,10);return raw.split('-').reverse().join('/')};
const defaultDate=()=>new Date().toLocaleDateString('sv-SE');
export default function Rotas(){
 const [rows,setRows]=useState<RouteRow[]>([]),[agents,setAgents]=useState<Pick[]>([]),[companies,setCompanies]=useState<Company[]>([]);
 const [role,setRole]=useState<'admin'|'supervisor'|'agent'|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [showForm,setShowForm]=useState(false),[step,setStep]=useState(0),[filter,setFilter]=useState('all'),[agent,setAgent]=useState(''),[date,setDate]=useState(defaultDate);
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false);
 const [selected,setSelected]=useState<string[]>([]),[selectedNames,setSelectedNames]=useState<Record<string,string>>({});
 const [cities,setCities]=useState<AreaOption[]>([]),[districts,setDistricts]=useState<AreaOption[]>([]);
 const districtRequest=useRef(0),companyRequest=useRef(0);
 const [city,setCity]=useState(''),[district,setDistrict]=useState(''),[areasLoading,setAreasLoading]=useState(false),[companiesLoading,setCompaniesLoading]=useState(false);
 const [selectionNotice,setSelectionNotice]=useState('');
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
   const [people,areas]=await Promise.all([fetch('/api/equipe',{cache:'no-store'}),fetch('/api/rotas/bairros',{cache:'no-store'})]);
   const [pd,ad]=await Promise.all([people.json(),areas.json()]);
   if(!people.ok||!areas.ok)throw Error(pd.error||ad.error||'Falha ao carregar os bairros.');
   if(!live)return;setAgents((pd.items||[]).map((x:{id:string;full_name:string})=>({id:x.id,name:x.full_name})));
   setCities(ad.cities||[]);
  }catch(e){if(live)setError(e instanceof Error?e.message:'Falha ao abrir as rotas')}
  finally{if(live)setLoading(false)}})();
  return()=>{live=false};
 },[]);
 async function findCompanies(nextPage=1,q=search,areaCity=city,areaDistrict=district,areaDate=date){
  if(!areaCity||!areaDistrict)return;
  const request=++companyRequest.current;
  setCompaniesLoading(true);setError('');
  try{
   const params=new URLSearchParams({q,page:String(nextPage),city:areaCity,district:areaDistrict,available_on:areaDate,purpose:'route'});
   const res=await fetch('/api/companies?'+params,{cache:'no-store'});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Falha na busca');
   if(request===companyRequest.current){setCompanies(data.items||[]);setHasMore(Boolean(data.hasMore));setPage(nextPage)}
  }catch(e){if(request===companyRequest.current)setError(e instanceof Error?e.message:'Busca indisponível')}
  finally{if(request===companyRequest.current)setCompaniesLoading(false)}
 }
 async function chooseCity(next:string){
  if(next===city)return;
  if(selected.length&&!window.confirm('Mudar de município removerá as empresas selecionadas. Continuar?'))return;
  const request=++districtRequest.current;companyRequest.current++;
  setCompaniesLoading(false);setCity(next);setDistrict('');setDistricts([]);setSelected([]);setSelectedNames({});
  setCompanies([]);setSearch('');setSearchInput('');setPage(1);setHasMore(false);setError('');
  if(!next)return;
  setAreasLoading(true);
  try{
   const res=await fetch('/api/rotas/bairros?'+new URLSearchParams({city:next}),{cache:'no-store'});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível consultar bairros.');
   if(request===districtRequest.current)setDistricts(data.districts||[]);
  }catch(e){if(request===districtRequest.current)setError(e instanceof Error?e.message:'Falha ao consultar bairros')}
  finally{if(request===districtRequest.current)setAreasLoading(false)}
 }
 function chooseDistrict(next:string){
  if(next===district)return;
  if(selected.length&&!window.confirm('Mudar de bairro removerá as empresas selecionadas. Continuar?'))return;
  companyRequest.current++;setCompaniesLoading(false);
  setDistrict(next);setSelected([]);setSelectedNames({});setSearch('');setSearchInput('');
  setCompanies([]);setPage(1);setHasMore(false);
  if(next)void findCompanies(1,'',city,next);
 }
 function changeDate(next:string){
  if(next===date)return;
  if(selected.length&&!window.confirm('Alterar a data limpará as empresas selecionadas. Continuar?'))return;
  setDate(next);setSelected([]);setSelectedNames({});setSelectionNotice('');
  companyRequest.current++;setCompaniesLoading(false);setCompanies([]);setHasMore(false);setPage(1);
  if(city&&district&&next)void findCompanies(1,search,city,district,next);
 }
 function selectPage(){
  const next=addVisibleStops(selected,companies.map(x=>x.id));
  const fresh=companies.filter(x=>next.includes(x.id)&&!selected.includes(x.id));
  setSelected(next);
  setSelectedNames(old=>Object.assign({},old,...fresh.map(x=>({[x.id]:x.trade_name||x.legal_name}))));
  setSelectionNotice(fresh.length?fresh.length+' empresas adicionadas desta página.':'Nenhuma empresa nova disponível nesta página.');
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
  if(!city||!district||neighborhoodKey(company)!==neighborhoodKey({city,district})){
   setError('A sugestão pertence a outro bairro. Crie outro roteiro para essa região.');return;
  }
  setSelectedNames(names=>({...names,[company.id]:company.trade_name||company.legal_name}));
  setSelected(previous=>previous.includes(company.id)||previous.length>=49?previous:[...previous,company.id]);
 };
 async function create(e:React.FormEvent){
  e.preventDefault();if(!agent||!selected.length||!date||!city||!district)return;
  setBusy(true);setError('');setMessage('');
  try{
   const res=await fetch('/api/rotas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent_id:agent,date,establishment_ids:selected})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível criar');
   setMessage('Rota criada com '+data.count+' empresas. Publique-a quando estiver pronta para a equipe.');
   setSelected([]);setSelectedNames({});setShowForm(false);setStep(0);await reload();
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
 const steps=[{label:'Região',detail:'Onde visitar',icon:MapPin},{label:'Equipe',detail:'Quem e quando',icon:UserRound},{label:'Empresas',detail:'Monte o percurso',icon:Layers},{label:'Revisão',detail:'Tudo pronto',icon:Check}];
 const regionReady=Boolean(city&&district);
 const teamReady=Boolean(agent&&date);
 const companiesReady=selected.length>0&&selected.length<=49;
 const reached=[true,regionReady,regionReady&&teamReady,regionReady&&teamReady&&companiesReady];
 const canNext=step===0?regionReady:step===1?teamReady:step===2?companiesReady:false;
 const currentAgent=agents.find(a=>a.id===agent)?.name||'Selecione o responsável';
 const progress=Math.round((step+1)/4*100);
 const active=rows.filter(r=>['published','in_progress'].includes(r.status)).length,drafts=rows.filter(r=>r.status==='draft').length,done=rows.filter(r=>r.status==='completed').length;
 return <Portal title="Rotas" subtitle={canPlan?'Planejamento inteligente por bairro e acompanhamento de campo.':'Suas jornadas de campo, em ordem de prioridade.'}>
  <div className="routes-shell routes-premium">
   {error&&<p className="error" role="alert">{error}</p>}
   {message&&<p className="success" role="status">{message}</p>}
   {canPlan&&<section className={'routes-builder routes-studio'+(showForm?' routes-studio-open':'')}>
    <div className="routes-studio-hero">
     <div className="routes-studio-orbit" aria-hidden="true"/>
     <div className="routes-studio-intro">
      <span className="routes-studio-kicker"><Sparkles size={14}/> ESTÚDIO DE ROTAS</span>
      <h2>Um bairro.<br/><em>Um roteiro melhor.</em></h2>
      <p>Planeje em quatro passos, sem formulários extensos.</p>
     </div>
     <button className="routes-studio-start" type="button" disabled={busy} onClick={()=>setShowForm(v=>!v)} aria-expanded={showForm}>
      {showForm?'Fechar planejamento':'Planejar nova rota'} {showForm?<Check size={18}/>:<ArrowRight size={19}/>}
     </button>
    </div>
    {showForm&&<div className="routes-wizard" aria-label="Assistente de criação de rota">
     <nav className="routes-wizard-steps" aria-label="Etapas do planejamento">
      {steps.map((item,i)=><button key={item.label} type="button" className={'routes-wizard-step'+(step===i?' active':'')+(i<step?' done':'')} disabled={!reached[i]||busy} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}>
       <span className="routes-wizard-step-dot">{i<step?<Check size={15}/>:String(i+1).padStart(2,'0')}</span>
       <span><strong>{item.label}</strong><small>{item.detail}</small></span>
      </button>)}
     </nav>
     <div className="routes-wizard-meter" role="progressbar" aria-label="Progresso da criação" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step+1}><span style={{width:progress+'%'}}/></div>
     <form onSubmit={create} className="routes-wizard-form">
      <div className="routes-wizard-scene" key={step}>
      {step===0&&<div className="routes-scene-content">
       <div className="routes-wizard-heading"><span>01 / REGIÃO</span><h3>Por onde começamos?</h3><p>Escolha a cidade e o bairro. Cada roteiro cobre uma região.</p></div>
       <div className="routes-neighborhood-picker" aria-label="Separar roteiro por município e bairro">
        <div className="routes-area-fields">
         <label>Município<select value={city} onChange={e=>void chooseCity(e.target.value)} required>
          <option value="">Escolha a cidade</option>
          {cities.map(x=><option key={x.name} value={x.name}>{x.name} · {x.count} empresas</option>)}
         </select></label>
         <label>Bairro<select value={district} onChange={e=>chooseDistrict(e.target.value)} required disabled={!city||areasLoading}>
          <option value="">{areasLoading?'Consultando bairros...':'Escolha o bairro'}</option>
          {districts.map(x=><option key={x.name} value={x.name}>{x.name} · {x.count} empresas</option>)}
         </select></label>
        </div>
        {city&&district&&<div className="routes-area-highlight"><MapPin size={19}/><span><strong>{district}</strong><small>{city} · {districts.find(x=>x.name===district)?.count??'—'} empresas cadastradas</small></span><Check size={20}/></div>}
        {city&&!areasLoading&&!districts.length&&<p className="routes-area-warning">Sem bairros cadastrados nesta cidade. Confira os endereços da base.</p>}
       </div>
      </div>}
      {step===1&&<div className="routes-scene-content">
       <div className="routes-wizard-heading"><span>02 / EQUIPE</span><h3>Quem vai para campo?</h3><p>Defina o responsável e a data. A disponibilidade das empresas será conferida para esse dia.</p></div>
       <div className="routes-form-top routes-wizard-team">
        <label><UserRound size={17}/> Responsável<select value={agent} onChange={e=>setAgent(e.target.value)} required><option value="">Selecione o agente</option>{agents.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
        <label><CalendarDays size={17}/> Data de atendimento<input type="date" required value={date} onChange={e=>changeDate(e.target.value)}/></label>
       </div>
       {teamReady&&<div className="routes-wizard-ready"><Check size={18}/> Equipe e data definidas. Avance para selecionar as empresas.</div>}
      </div>}
      {step===2&&<div className="routes-scene-content">
       <div className="routes-wizard-heading"><span>03 / EMPRESAS</span><h3>Monte o percurso.</h3><p>{district+' · '+city} — selecione até 49 empresas disponíveis em {dateLabel(date)}.</p></div>
       <div className="routes-company-heading"><div><strong>Empresas disponíveis</strong><p>Toque para adicionar ou use a seleção rápida.</p></div><span>{selected.length} / 49</span></div>
       <div className="routes-search" role="search"><Search size={18}/><input aria-label="Buscar empresa no bairro" value={searchInput} onChange={e=>setSearchInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setSearch(searchInput);void findCompanies(1,searchInput)}}} placeholder="Buscar por nome ou CNPJ"/>
        <button type="button" disabled={companiesLoading} onClick={()=>{setSearch(searchInput);void findCompanies(1,searchInput)}}>Buscar</button></div>
       <div className="routes-selection-toolbar"><span>{companiesLoading?'Buscando empresas...':companies.length+' empresas nesta página'} · {selected.length} selecionadas</span>
        <div><button type="button" disabled={!companies.length||selected.length>=49||!companies.some(x=>!selected.includes(x.id))} onClick={selectPage}><Plus size={15}/> Adicionar página</button>
        <button type="button" disabled={!selected.length} onClick={()=>{setSelected([]);setSelectedNames({});setSelectionNotice('')}}>Limpar</button></div>
       </div>
       {selectionNotice&&<p className="routes-selection-note" role="status">{selectionNotice}</p>}
       <div className="routes-company-choices" aria-busy={companiesLoading}>{companies.map(company=><label key={company.id} className={selected.includes(company.id)?'is-selected':''}>
        <input type="checkbox" checked={selected.includes(company.id)} disabled={!selected.includes(company.id)&&selected.length>=49} onChange={()=>toggle(company)}/>
        <span className="routes-company-avatar" aria-hidden="true"><Layers size={18}/></span>
        <span><strong>{company.trade_name||company.legal_name}</strong><small>{company.district||'Bairro não informado'} · {company.city||'Município não informado'} {company.cnpj?'· '+company.cnpj:''}</small></span>
        <span className="routes-company-check" aria-hidden="true"><Check size={16}/></span>
       </label>)}
       {!companies.length&&<p className="routes-empty" role="status">{companiesLoading?'Consultando empresas...':'Nenhuma empresa encontrada. Tente outra busca.'}</p>}</div>
       <div className="routes-pagination"><button type="button" disabled={page===1||companiesLoading} onClick={()=>void findCompanies(page-1)}><ChevronLeft size={17}/> Anterior</button><span>Página {page}</span><button type="button" disabled={!hasMore||companiesLoading} onClick={()=>void findCompanies(page+1)}>Próxima <ChevronRight size={17}/></button></div>
      </div>}
      {step===3&&<div className="routes-scene-content">
       <div className="routes-wizard-heading"><span>04 / REVISÃO</span><h3>Seu roteiro está pronto.</h3><p>Confira os dados e salve em rascunho. A publicação será feita depois.</p></div>
       <div className="routes-review-grid">
        <div><MapPin size={18}/><small>Região</small><strong>{district} · {city}</strong></div>
        <div><UserRound size={18}/><small>Agente</small><strong>{currentAgent}</strong></div>
        <div><CalendarDays size={18}/><small>Data</small><strong>{dateLabel(date)}</strong></div>
        <div><Layers size={18}/><small>Paradas</small><strong>{selected.length} de 49</strong></div>
       </div>
       <RouteChosenList ids={selected} names={selectedNames} onMove={moveSelected} onRemove={id=>setSelected(previous=>previous.filter(x=>x!==id))}/>
       <RouteProximityPanel selectedIds={selected} date={date} onAdd={addNearby} city={city} district={district}/>
       <p className="routes-proximity-disclaimer">A rota ficará em rascunho. Antes de publicar, confira a proximidade e o trajeto viário.</p>
      </div>}
      </div>
      <div className="routes-wizard-footer">
       <div className="routes-wizard-summary"><span>SEU ROTEIRO</span><strong>{district||'Escolha um bairro'}</strong><small>{selected.length} {selected.length===1?'empresa':'empresas'} selecionadas</small></div>
       <div className="routes-wizard-controls">
        {step>0&&<button type="button" className="routes-wizard-back" disabled={busy} onClick={()=>setStep(x=>x-1)}><ArrowLeft size={17}/> Voltar</button>}
        {step<3?<button type="button" className="routes-wizard-next" disabled={!canNext||busy} onClick={()=>{if(step===1&&regionReady&&teamReady&&city&&district)void findCompanies(1,search,city,district,date);setStep(x=>Math.min(3,x+1))}}>
         Continuar <ArrowRight size={18}/>
        </button>:<button className="routes-wizard-next" disabled={busy||!selected.length||!agent||!date||!city||!district} type="submit"><RouteIcon size={18}/>{busy?'Salvando...':'Criar roteiro'}<ArrowRight size={17}/></button>}
       </div>
      </div>
     </form>
    </div>}
   </section>}
   <div className="routes-section-divider">
    <div><span className="routes-section-kicker">CENTRAL OPERACIONAL</span><h2>{role==='agent'?'Minhas rotas':'Seus roteiros'}</h2><p>Encontre o que precisa e continue de onde parou.</p></div>
    <div className="routes-overview-mini" aria-label="Resumo de rotas"><span><strong>{active}</strong> em campo</span><span><strong>{drafts}</strong> a publicar</span><span><strong>{done}</strong> concluídas</span></div>
   </div>
   <section className="routes-list-section routes-list-premium">
    <div className="routes-filters" role="group" aria-label="Filtrar rotas">
     {([['all','Todas'],['active','Em campo'],['draft','A publicar'],['completed','Concluídas']] as [string,string][]).filter(x=>role!=='agent'||x[0]!=='draft').map(([key,label])=><button type="button" aria-pressed={filter===key} className={filter===key?'active':''} key={key} onClick={()=>setFilter(key)}>{label}</button>)}
    </div>
    <div className="routes-cards">{visible.map((r,index)=><article key={r.id} className="routes-item routes-item-premium" style={{animationDelay:Math.min(index,8)*45+'ms'}}>
     <div className="routes-item-icon"><RouteIcon size={22}/></div>
     <div className="routes-item-content">
      <div><strong>{r.neighborhood_label&&r.neighborhood_label!=='Bairro não informado'&&r.neighborhood_label!=='Regiões variadas'?r.neighborhood_label:'Rota de '+dateLabel(r.route_date)}</strong><span className={'routes-state routes-state-'+r.status}>{states[r.status]||r.status}</span></div>
      <p><UserRound size={15}/>{r.agent_name}<span>·</span><MapPin size={15}/>{r.stops} {r.stops===1?'empresa':'empresas'}<span>·</span><CalendarDays size={15}/>{dateLabel(r.route_date)}</p>
      {(r.neighborhood_label==='Regiões variadas'||r.neighborhood_label==='Bairro não informado')&&<small className="routes-area-caption">{r.neighborhood_label}</small>}
     </div>
     <div className="routes-item-actions">
      {canPlan&&r.status==='draft'&&<button type="button" className="routes-publish" disabled={busy} onClick={()=>void publish(r.id)}><Send size={16}/> Publicar</button>}
      <Link href={(role==='agent'?'/campo/':'/rotas/')+r.id} className="routes-open">{role==='agent'?'Abrir jornada':'Ver percurso'}<ChevronRight size={17}/></Link>
     </div>
    </article>)}
     {!visible.length&&<div className="routes-empty"><Layers size={29}/><strong>{loading?'Carregando rotas...':'Nenhuma rota neste filtro'}</strong><p>{role==='agent'?'Suas rotas aparecem aqui quando publicadas.':'Crie uma rota ou selecione outro filtro.'}</p></div>}
    </div>
   </section>
  </div>
 </Portal>;
}
