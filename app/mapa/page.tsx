'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Portal} from '@/components/portal';
import {Building2,CheckCircle2,MapPin,Search,Layers,CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import './territorio.css';
type Metric='total'|'pending'|'review'|'validated'|'invalid'|'registered';
type Row={city:string;ibge_code:string|null;total:number;pending:number;review:number;validated:number;invalid:number;registered:number};
type Company={id:string;cnpj:string;legal_name:string;trade_name:string|null;field_status:string;registered:boolean};
type Shape={type:'FeatureCollection';features:{type:'Feature';properties:{id:string;name:string};geometry:unknown}[]};
type MapInstance={remove:()=>void;fitBounds:(bounds:unknown,opts?:unknown)=>void};
type Layer={addTo:(map:MapInstance)=>Layer;getBounds:()=>unknown;on:(event:string,listener:()=>void)=>void;bindTooltip:(text:string)=>Layer};
type Leaflet={map:(node:HTMLElement,options:unknown)=>MapInstance;tileLayer:(url:string,options:unknown)=>Layer;geoJSON:(geo:Shape,options:unknown)=>Layer};
const labels:Record<Metric,string>={total:'Empresas na base',pending:'A visitar',review:'Em análise',validated:'Validadas em campo',invalid:'Inconsistentes',registered:'Cadastros sindicais'};
const statusLabels:Record<string,string>={pending:'A visitar',review:'Em análise',validated:'Validada',invalid:'Inconsistente'};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const fmt=(n:number)=>n.toLocaleString('pt-BR');
let pendingLeaflet:Promise<Leaflet>|null=null;
function leaflet():Promise<Leaflet>{
 if(typeof window==='undefined')return Promise.reject(Error('Mapa disponível no navegador.'));
 const win=window as typeof window&{L?:Leaflet};
 if(win.L)return Promise.resolve(win.L);
 if(pendingLeaflet)return pendingLeaflet;
 pendingLeaflet=new Promise<Leaflet>((resolve,reject)=>{
  if(!document.querySelector('link[data-territory-leaflet]')&&!document.querySelector('link[data-field-leaflet]')){
   const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.dataset.territoryLeaflet='1';document.head.appendChild(link);
  }
  const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.async=true;
  script.onload=()=>win.L?resolve(win.L):reject(Error('Mapa indisponível.'));script.onerror=()=>reject(Error('Não foi possível carregar o mapa.'));
  document.head.appendChild(script);
 }).catch(e=>{pendingLeaflet=null;throw e});
 return pendingLeaflet;
}
function fill(value:number,max:number){
 if(value===0)return '#e9eee9';
 const level=Math.log1p(value)/Math.log1p(Math.max(1,max));
 return level>.78?'#b84616':level>.55?'#ef6e27':level>.31?'#f7a965':'#ffdcc0';
}
function TerritoryMap({shape,metrics,metric,onSelect}:{shape:Shape;metrics:Map<string,Row>;metric:Metric;onSelect:(city:string)=>void}){
 const node=useRef<HTMLDivElement|null>(null),callback=useRef(onSelect),[error,setError]=useState('');
 useEffect(()=>{callback.current=onSelect},[onSelect]);
 useEffect(()=>{let disposed=false,instance:MapInstance|null=null;setError('');
  leaflet().then(L=>{
   if(disposed||!node.current)return;
   instance=L.map(node.current,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true});
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:17}).addTo(instance);
   const max=Math.max(1,...Array.from(metrics.values()).map(row=>Number(row[metric]||0)));
   const polygons=L.geoJSON(shape,{
    style:(feature:{properties:{id:string;name:string}})=>{
     const count=Number((metrics.get(feature.properties.id)||metrics.get(normalize(feature.properties.name)))?.[metric]||0);
     return {color:'#ffffff',weight:.75,opacity:.85,fillOpacity:.87,fillColor:fill(count,max)};
    },
    onEachFeature:(feature:{properties:{id:string;name:string}},layer:Layer)=>{
     const item=metrics.get(feature.properties.id)||metrics.get(normalize(feature.properties.name));
     layer.bindTooltip(feature.properties.name+' · '+fmt(Number(item?.[metric]||0)));
     layer.on('click',()=>callback.current(feature.properties.name));
    }
   }).addTo(instance);
   instance.fitBounds(polygons.getBounds(),{padding:[12,12]});
  }).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'Mapa indisponível')});
  return()=>{disposed=true;instance?.remove()};
 },[shape,metrics,metric]);
 return <div className="territory-map">
  {error&&<div className="territory-map-error" role="alert">{error}</div>}
  <div ref={node} className="territory-map-canvas" role="region" aria-label="Mapa interativo com os limites dos 645 municípios paulistas. Selecione uma cidade para consultar empresas."/>
  <div className="territory-map-source">Fonte geográfica: IBGE / geodata-br · Dados operacionais da plataforma</div>
 </div>;
}
export default function Territorio(){
 const [shape,setShape]=useState<Shape|null>(null),[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[mapError,setMapError]=useState(''),[error,setError]=useState('');
 const [metric,setMetric]=useState<Metric>('total'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[citySearch,setCitySearch]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const [companies,setCompanies]=useState<Company[]>([]),[companiesPage,setCompaniesPage]=useState(1),[companiesMore,setCompaniesMore]=useState(false),[companiesError,setCompaniesError]=useState(''),[companiesLoading,setCompaniesLoading]=useState(false);
 useEffect(()=>{let alive=true;
  fetch('/api/territorio/malha',{cache:'no-store'}).then(async response=>{const d=await response.json();if(!response.ok)throw Error(d.error||'Falha no mapa');if(alive)setShape(d as Shape)}).catch(e=>{if(alive)setMapError(e instanceof Error?e.message:'Malha indisponível')});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{let alive=true;setLoading(true);setError('');
  fetch('/api/territorio?'+new URLSearchParams({from,to}).toString(),{cache:'no-store'}).then(async response=>{const d=await response.json();if(!response.ok)throw Error(d.error||'Falha nos indicadores');if(alive)setRows(d.items||[])})
  .catch(e=>{if(alive)setError(e instanceof Error?e.message:'Indicadores indisponíveis')}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[from,to]);
 const metrics=useMemo(()=>{
  const map=new Map<string,Row>();
  for(const row of rows){
   const key=row.ibge_code||normalize(row.city),current=map.get(key);
   if(current){for(const field of ['total','pending','review','validated','invalid','registered'] as Metric[])current[field]+=Number(row[field]||0)}
   else map.set(key,{...row,total:Number(row.total),pending:Number(row.pending),review:Number(row.review),validated:Number(row.validated),invalid:Number(row.invalid),registered:Number(row.registered)});
  }
  return map;
 },[rows]);
 const byName=useMemo(()=>new Map(rows.map(r=>[normalize(r.city),r])),[rows]);
 const totals=useMemo(()=>rows.reduce((all,row)=>({total:all.total+Number(row.total),pending:all.pending+Number(row.pending),review:all.review+Number(row.review),validated:all.validated+Number(row.validated),invalid:all.invalid+Number(row.invalid),registered:all.registered+Number(row.registered)}),{total:0,pending:0,review:0,validated:0,invalid:0,registered:0}),[rows]);
 const cities=useMemo(()=>shape?.features.map(f=>f.properties.name).filter(name=>normalize(name).includes(normalize(citySearch))).sort((a,b)=>Number(byName.get(normalize(b))?.[metric]||0)-Number(byName.get(normalize(a))?.[metric]||0)||a.localeCompare(b,'pt-BR'))||[],[shape,citySearch,metric,byName]);
 const selectedMetric=selected?byName.get(normalize(selected)):null;
 useEffect(()=>{
  if(!selected){setCompanies([]);return}
  let alive=true;setCompaniesLoading(true);setCompaniesError('');
  fetch('/api/territorio/empresas?'+new URLSearchParams({city:selected,from,to,page:String(companiesPage)}).toString(),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível consultar empresas');if(alive){setCompanies(d.items||[]);setCompaniesMore(Boolean(d.hasMore))}})
   .catch(e=>{if(alive){setCompanies([]);setCompaniesError(e instanceof Error?e.message:'Falha ao consultar')}})
   .finally(()=>{if(alive)setCompaniesLoading(false)});
  return()=>{alive=false};
 },[selected,companiesPage,from,to]);
 const choose=(city:string)=>{setSelected(city);setCompaniesPage(1)};
 return <Portal title="Mapa de cobertura" subtitle="645 municípios paulistas · empresas por cidade e situação">
  <div className="territory-shell">
   <section className="territory-stats" aria-label="Resumo da base">
    <div><span><Building2 size={17}/> Empresas na base</span><strong>{fmt(totals.total)}</strong></div>
    <div><span>Validadas</span><strong>{fmt(totals.validated)}</strong></div>
    <div><span>Cadastros confirmados</span><strong>{fmt(totals.registered)}</strong></div>
    <div><span>Cidades com registros</span><strong>{fmt(new Set(rows.map(r=>normalize(r.city)).filter(c=>c!=='nao informado')).size)} <small>/ 645</small></strong></div>
   </section>
   <section className="territory-toolbar" aria-label="Filtros territoriais">
    <label><Layers size={17}/> Visualizar
     <select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{(Object.entries(labels) as [Metric,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    </label>
    <label><CalendarDays size={17}/> De<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Até<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label>
    {(from||to)&&<button className="territory-clear" onClick={()=>{setFrom('');setTo('')}} type="button">Limpar período</button>}
   </section>
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="territory-layout">
    <div className="territory-map-panel">
     {shape?<TerritoryMap shape={shape} metrics={metrics} metric={metric} onSelect={choose}/>:<div className="territory-map-placeholder">{mapError||'Carregando mapa dos municípios...'}</div>}
     <div className="territory-legend"><span>Mapa: {labels[metric]}</span><span className="territory-swatch zero"/> Sem registros <span className="territory-swatch low"/> Poucos <span className="territory-swatch high"/> Muitos</div>
     {loading&&<p className="territory-muted" role="status">Atualizando indicadores...</p>}
     <p className="territory-muted">O período filtra empresas inseridas na plataforma, não necessariamente empresas abertas naquele período. O cadastro sindical confirmado é contado separadamente.</p>
    </div>
    <aside className="territory-side">
     <div className="territory-side-heading"><span><MapPin size={17}/> {selected?'Município selecionado':'Encontre uma cidade'}</span>
      {selected&&<button type="button" onClick={()=>setSelected(null)} aria-label="Voltar à lista de cidades">Voltar</button>}
     </div>
     {selected?<div className="territory-selected">
      <h2>{selected}</h2>
      <div className="territory-selected-stats">
       <div><span>Empresas</span><strong>{fmt(Number(selectedMetric?.total||0))}</strong></div>
       <div><span>Validadas</span><strong>{fmt(Number(selectedMetric?.validated||0))}</strong></div>
       <div><span>Cadastros confirmados</span><strong>{fmt(Number(selectedMetric?.registered||0))}</strong></div>
       <div><span>Pendentes</span><strong>{fmt(Number(selectedMetric?.pending||0))}</strong></div>
      </div>
      <h3>Situação das empresas</h3>
      {companiesError&&<p className="error">{companiesError}</p>}
      <div className="territory-company-list">{companies.map(company=><div key={company.id} className="territory-company">
       <strong>{company.trade_name||company.legal_name}</strong>
       <span>{company.cnpj}</span>
       <small>{company.registered?<><CheckCircle2 size={13}/> Cadastro confirmado</>:statusLabels[company.field_status]||company.field_status}</small>
      </div>)}
      {!companies.length&&<p className="territory-muted">{companiesLoading?'Consultando empresas...':'Nenhuma empresa nessa cidade para o período selecionado.'}</p>}
      </div>
      <div className="territory-pagination"><button type="button" disabled={companiesPage===1||companiesLoading} onClick={()=>setCompaniesPage(p=>p-1)} aria-label="Página anterior"><ChevronLeft size={18}/></button><span>Página {companiesPage}</span><button type="button" disabled={!companiesMore||companiesLoading} onClick={()=>setCompaniesPage(p=>p+1)} aria-label="Próxima página"><ChevronRight size={18}/></button></div>
     </div>:<>
      <div className="territory-search"><Search size={17}/><input aria-label="Buscar município" placeholder="Buscar município..." value={citySearch} onChange={e=>setCitySearch(e.target.value)}/></div>
      <p className="territory-muted">{shape?cities.length+' municípios encontrados':'Carregando municípios...'}</p>
      <div className="territory-city-list">{cities.slice(0,645).map(name=><button type="button" key={name} onClick={()=>choose(name)}>
       <span>{name}</span><strong>{fmt(Number(byName.get(normalize(name))?.[metric]||0))}</strong><ChevronRight size={16}/></button>)}
      {!cities.length&&shape&&<p className="territory-muted">Nenhum município corresponde à busca.</p>}
      </div>
     </>}
    </aside>
   </div>
  </div>
 </Portal>;
}
