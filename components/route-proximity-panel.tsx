'use client';
import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,Compass,Info,MapPin,Plus,Route as RouteIcon} from 'lucide-react';
import {FieldNavigationMap,type FieldPlan} from '@/components/field-navigation-map';

export type NearbyCompany={
 id:string;legal_name:string;trade_name:string|null;city:string|null;district:string|null;
 postal_code:string|null;nearest_km:number|null;reason:string
};
type Assessment={
 selected:number;located:number;coverage:number;known_legs:number;
 straight_leg_km:number|null;max_jump_km:number|null;span_km:number|null;
 risk:'high'|'attention'|'compact'|'unknown';warnings:string[];
 cities:{city:string;count:number}[];points:{id:string;lat:number;lon:number}[]
};
type Result={assessment:Assessment;suggestions:NearbyCompany[];basis:string;error?:string};
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('pt-BR',{maximumFractionDigits:1})+' km';

export function RouteProximityPanel({selectedIds,date,routeId,onAdd,city,district}:{
 selectedIds:string[];date:string;routeId?:string;city?:string;district?:string;onAdd:(company:NearbyCompany)=>void
}){
 const [data,setData]=useState<Result|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{
  if(!selectedIds.length||!expanded){setData(null);setError('');setLoading(false);return}
  let live=true;const ctrl=new AbortController();
  setLoading(true);setError('');setData(null);
  const timer=window.setTimeout(()=>{
   fetch('/api/rotas/planejamento',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({establishment_ids:selectedIds,date,route_id:routeId}),
    signal:ctrl.signal,cache:'no-store'})
   .then(async response=>{const body=await response.json() as Result;if(!response.ok)throw Error(body.error||'Não foi possível analisar a rota.');return body})
   .then(result=>{if(live)setData(result)})
   .catch(e=>{if(live&&!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Falha na análise de proximidade.')})
   .finally(()=>{if(live)setLoading(false)});
  },300);
  return()=>{live=false;window.clearTimeout(timer);ctrl.abort()};
 },[selectedIds,date,routeId,expanded]);
 const a=data?.assessment;
 const same=(a:string|null|undefined,b:string)=>String(a||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()===b.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const suggestions=data?.suggestions.filter(x=>!city||!district||same(x.city,city)&&same(x.district,district))||[];
 const map=useMemo<FieldPlan|null>(()=>a?.points?.length?{
  order:selectedIds.filter(id=>a.points.some(p=>p.id===id)),points:a.points,
  geometry:{type:'LineString',coordinates:[]}
 }:null,[a,selectedIds]);
 if(!selectedIds.length)return null;
 return <section className="routes-proximity" aria-label="Análise de proximidade da rota" aria-busy={loading}>
  <button className="routes-proximity-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
   <Compass size={20}/><span><strong>Conferir proximidade e sugestões</strong><small>Opcional durante a seleção · {selectedIds.length} {selectedIds.length===1?'empresa':'empresas'}</small></span>
   <span aria-hidden="true">{expanded?'Ocultar':'Analisar'}</span>
  </button>
  {expanded&&<>
  <div className="routes-proximity-heading">
   <Compass size={24}/>
   <div><strong>Inteligência de percurso</strong><small>Avaliação antes de enviar o agente à rua</small></div>
   {loading&&<span className="routes-proximity-loading" role="status">Analisando...</span>}
  </div>
  {error&&<p className="routes-proximity-error" role="alert">{error}</p>}
  {a&&<>
   <div className="routes-proximity-stats">
    <div><span>Empresas</span><strong>{a.selected}</strong></div>
    <div><span>Municípios</span><strong>{a.cities.length||'—'}</strong></div>
    <div><span>Com GPS</span><strong>{a.located}/{a.selected}</strong></div>
    <div><span>Maior separação*</span><strong>{fmt(a.span_km)}</strong></div>
   </div>
   <div className={'routes-proximity-result routes-proximity-'+a.risk}>
    {a.risk==='compact'?<CheckCircle2 size={21}/>:a.risk==='unknown'?<Info size={21}/>:<AlertTriangle size={21}/>}
    <div>
     <strong>{a.risk==='compact'?'Concentração geográfica favorável':a.risk==='high'?'Rota potencialmente dispersa':a.risk==='attention'?'Revise a distância entre as paradas':'Coordenadas insuficientes para medir distância'}</strong>
     {a.warnings.map((warning,i)=><p key={i}>{warning}</p>)}
     {a.risk==='compact'&&!a.warnings.length&&<p>As empresas geolocalizadas estão concentradas. Confira o trajeto viário antes de publicar.</p>}
    </div>
   </div>
   {a.cities.length>0&&<div className="routes-city-group"><span>Regiões selecionadas</span><div>{a.cities.map(x=><small key={x.city}>{x.city} <b>{x.count}</b></small>)}</div></div>}
   {map&&<div className="routes-geo-map">
    <FieldNavigationMap plan={map} compact/>
    <small><MapPin size={14}/> Pontos georreferenciados, sem rota viária calculada. *Distâncias em linha reta, sem trânsito ou tempo de atendimento.</small>
   </div>}
   {!map&&<p className="routes-geo-help"><Info size={16}/> Nenhuma das empresas selecionadas possui coordenadas. Você ainda pode aproveitar as sugestões pelo município, bairro e CEP.</p>}
   <div className="routes-suggestions-title"><div><strong>Empresas próximas que ainda podem entrar na rota</strong><p>Sugestões do cadastro interno, ainda não selecionadas e sem atribuição a outra rota ativa na mesma data.</p></div></div>
   {suggestions.length>0?<div className="routes-suggestions">
    {suggestions.map(x=><div className="routes-suggestion" key={x.id}>
     <div><strong>{x.trade_name||x.legal_name}</strong><small>{[x.district,x.city].filter(Boolean).join(' · ')||'Local não informado'}</small>
      <span>{x.reason}</span></div>
     <button type="button" onClick={()=>onAdd(x)} disabled={selectedIds.length>=49}
      aria-label={'Adicionar '+(x.trade_name||x.legal_name)+' à rota'}><Plus size={16}/> Adicionar</button>
    </div>)}
   </div>:<p className="routes-geo-help">Nenhuma sugestão disponível no bairro escolhido. Crie outro roteiro para atender outro bairro.</p>}
   <p className="routes-proximity-disclaimer"><RouteIcon size={15}/> A proximidade ajuda a selecionar empresas; não substitui a otimização pelas ruas no detalhe da rota. Município e CEP semelhantes não comprovam distância física curta.</p>
  </>}
  </>}
 </section>;
}
