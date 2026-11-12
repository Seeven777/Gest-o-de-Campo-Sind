'use client';
import {useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import {Portal} from '@/components/portal';
import Link from 'next/link';
import {MapPinned,Route as RouteIcon,RefreshCw,Navigation,Edit3,LockKeyhole} from 'lucide-react';
import {RouteCompanyEditor} from '@/components/route-company-editor';
import '../rotas.css';

type Stop={id:string;establishment_id:string;position_order:number;legal_name:string;trade_name:string|null;street:string|null;street_number:string|null;city:string|null;state:string|null;postal_code:string|null;cnpj:string};
type RouteMeta={id:string;route_date:string;status:string;stored_status:string;campaign_name:string;can_edit:boolean;edit_token:string};
type Point={id:string;lat:number;lon:number};
type Missing={id:string;name:string;address:string};
type Calculation={order:string[];points:Point[];geometry:{type:'LineString';coordinates:[number,number][]};distance_m:number|null;duration_s:number|null;estimated:boolean;geocoded:number;route_warning?:string;origin?:{lat:number;lon:number}|null;partial?:boolean;missing?:Missing[];total?:number;located?:number};
type Layer={addTo:(map:unknown)=>Layer;bindTooltip:(text:string)=>Layer};
type MapLike={fitBounds:(bounds:unknown,options?:unknown)=>void;remove:()=>void};
type Leaflet={map:(node:HTMLElement,options:unknown)=>MapLike;tileLayer:(url:string,options:unknown)=>Layer;polyline:(points:number[][],options:unknown)=>Layer;marker:(point:number[],options:unknown)=>Layer;divIcon:(options:unknown)=>unknown;latLngBounds:(points:number[][])=>unknown};
const leafletLoader=()=>{
 if(typeof window==='undefined')return Promise.reject(Error('Mapa disponível somente no navegador.'));
 const win=window as typeof window&{L?:Leaflet};
 if(win.L)return Promise.resolve(win.L);
 if(!document.querySelector('link[data-leaflet]')){const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.dataset.leaflet='1';document.head.appendChild(link)}
 return new Promise<Leaflet>((resolve,reject)=>{
  const existing=document.querySelector('script[data-leaflet]') as HTMLScriptElement|null;
  const script=existing||document.createElement('script');
  const done=()=>win.L?resolve(win.L):reject(Error('Não foi possível iniciar o mapa.'));
  if(existing){script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>reject(Error('Falha ao carregar mapa.')),{once:true});if(win.L)done()}
  else {script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.async=true;script.dataset.leaflet='1';script.onload=done;script.onerror=()=>reject(Error('Falha ao carregar o mapa.'));document.head.appendChild(script)}
 });
};
function RouteMap({data}:{data:Calculation}){
 const node=useRef<HTMLDivElement|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let closed=false;let map:MapLike|undefined;
 leafletLoader().then(L=>{
  if(closed||!node.current)return;
  map=L.map(node.current,{zoomControl:true,scrollWheelZoom:false});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
  const byId=new Map(data.points.map(p=>[p.id,p]));
  const positions:number[][]=[];
  data.order.forEach((id,i)=>{
   const p=byId.get(id);if(!p)return;
   const coords=[p.lat,p.lon];positions.push(coords);
   const marker=L.divIcon({className:'route-number-marker',html:'<span>'+String(i+1)+'</span>',iconSize:[32,32],iconAnchor:[16,16]});
   L.marker(coords,{icon:marker}).addTo(map!).bindTooltip('Parada '+(i+1));
  });
  if(data.origin){const icon=L.divIcon({className:'route-origin-marker',html:'<span>Início</span>',iconSize:[46,26],iconAnchor:[23,13]});L.marker([data.origin.lat,data.origin.lon],{icon}).addTo(map).bindTooltip('Ponto inicial escolhido pelo agente')}
  const line=data.geometry.coordinates.map(([lon,lat])=>[lat,lon]);
  if(line.length>1)L.polyline(line,{color:'#fa6920',weight:5,opacity:.9}).addTo(map);
  const bounds=L.latLngBounds(line.length>1?line:positions);
  map.fitBounds(bounds,{padding:[35,35],maxZoom:15});
 }).catch(e=>{if(!closed)setError(e instanceof Error?e.message:'Falha ao exibir mapa')});
 return()=>{closed=true;map?.remove()};
 },[data]);
 return <div style={{position:'relative'}}>{error&&<p className="error">{error}</p>}
 <div ref={node} style={{height:480,width:'100%',borderRadius:16,overflow:'hidden',background:'#eef3ed'}} role="img" aria-label="Mapa do trajeto sugerido e empresas numeradas"/>
 <style jsx global>{`.route-number-marker{border:2px solid #fff;background:#fb6b22;border-radius:50%;box-shadow:0 2px 9px #0005;color:#fff;text-align:center;font-weight:800;line-height:28px} .route-number-marker span{font-size:13px}.route-origin-marker{background:#1d5945;border:2px solid #fff;color:white;border-radius:16px;box-shadow:0 2px 6px #0004;font-size:10px;font-weight:800;text-align:center;line-height:22px}`}</style>
 </div>
}
const fmtDistance=(n:number)=>(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km';
const fmtDuration=(n:number)=>Math.round(n/60).toLocaleString('pt-BR')+' min';

export default function DetalheRota(){
 const {id}=useParams<{id:string}>();const [stops,setStops]=useState<Stop[]>([]),[title,setTitle]=useState(''),[error,setError]=useState(''),[routeError,setRouteError]=useState(''),[loading,setLoading]=useState(true),[calculating,setCalculating]=useState(false),[progress,setProgress]=useState(''),[useGps,setUseGps]=useState(false),[data,setData]=useState<Calculation|null>(null);
 const [meta,setMeta]=useState<RouteMeta|null>(null),[canManage,setCanManage]=useState(false),[editing,setEditing]=useState(false),[saved,setSaved]=useState('');
 useEffect(()=>{let current=true;fetch('/api/rotas/'+encodeURIComponent(id),{cache:'no-store'})
 .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(current){setStops(d.stops||[]);setTitle(d.route.campaign_name);setMeta(d.route)}})
 .catch(e=>{if(current)setError(e instanceof Error?e.message:'Falha ao carregar rota')}).finally(()=>{if(current)setLoading(false)});
 return()=>{current=false}},[id]);
 useEffect(()=>{let mounted=true;fetch('/api/me',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
 .then(d=>{if(mounted)setCanManage(['admin','supervisor'].includes(d?.user?.role))})
 .catch(()=>{if(mounted)setCanManage(false)});return()=>{mounted=false}},[]);
 async function refreshAfterEdit(){
  const response=await fetch('/api/rotas/'+encodeURIComponent(id),{cache:'no-store'});
  const d=await response.json();if(!response.ok)throw Error(d.error||'Não foi possível atualizar o percurso.');
  setStops(d.stops||[]);setTitle(d.route.campaign_name);setMeta(d.route);setData(null);setRouteError('');
  setEditing(false);setSaved('Empresas e ordem atualizadas com sucesso. Recalcule o trajeto antes da saída do agente.');
 }
 async function optimize(){
  setCalculating(true);setRouteError('');setProgress('Preparando endereços...');
  try{let start: {lat:number;lon:number}|undefined;
   if(useGps){const point=await new Promise<GeolocationPosition>((resolve,reject)=>{if(!navigator.geolocation)return reject(Error('Este navegador não possui suporte a GPS.'));navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0})});start={lat:point.coords.latitude,lon:point.coords.longitude}}
   let complete=false;
   for(let batch=1;batch<=12;batch++){
    setProgress('Consultando endereços e calculando o percurso · etapa '+batch);
    const r=await fetch('/api/rotas/'+encodeURIComponent(id)+'/otimizar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start}),cache:'no-store'});
    const response=await r.json();
    if(r.ok){setData(response as Calculation);complete=true;break}
    if(r.status===422&&response.retryable===true&&batch<12){
      setProgress('Coordenadas encontradas. Faltam '+response.remaining+' empresas — continuando automaticamente...');
      continue;
    }
    throw Error(response.error||'Falha na otimização');
   }
   if(!complete)throw Error('A consulta atingiu o limite de tentativas. Confira os endereços antes de tentar novamente.');
  }catch(e){setRouteError(e instanceof Error?e.message:'Falha ao calcular o trajeto')}finally{setCalculating(false);setProgress('')}
 }
 const byId=new Map(stops.map(s=>[s.id,s]));
 const sorted=data?[...data.order.map(i=>byId.get(i)).filter((s):s is Stop=>Boolean(s)),...stops.filter(s=>!data.order.includes(s.id))]:stops;
 return <Portal title="Percurso de campo" subtitle={title||'Empresas atribuídas à rota'}>
 {error&&<p className="error" role="alert">{error}</p>}
 {saved&&<p className="success" role="status">{saved}</p>}
 {canManage&&meta&&<section className="panel" style={{marginBottom:18}}>
  <div className="panel-title"><div><small>GESTÃO DAS PARADAS</small><h2>Empresas da rota e ordem de visita</h2></div><Edit3 size={22} color="#d66b26"/></div>
  <p className="muted" style={{lineHeight:1.65}}>Adicione empresas próximas, retire paradas desnecessárias ou reorganize o percurso antes de enviá-lo para o agente.</p>
  {meta.can_edit?<div style={{marginTop:13}}>
   {!editing&&<button className="button" type="button" onClick={()=>{setEditing(true);setSaved('')}}><Edit3 size={17}/> Adicionar ou editar empresas</button>}
   {editing&&<RouteCompanyEditor key={meta.edit_token} routeId={id} date={String(meta.route_date).slice(0,10)}
    editToken={meta.edit_token} published={meta.stored_status==='published'} stops={stops}
    onCancel={()=>setEditing(false)} onSaved={refreshAfterEdit}/>}
  </div>:<p className="routes-editor-note"><LockKeyhole size={17}/> Rota em execução, concluída ou com check-in/GPS já iniciado. Para preservar os registros da equipe, suas paradas não podem mais ser editadas.</p>}
 </section>}
 <section className="panel" style={{marginBottom:18}}>
 <div className="panel-title"><div><small>MAPA DO PERCURSO</small><h2>Melhor sequência de visitas</h2></div><MapPinned size={22} color="#ef702c"/></div>
 <p className="muted" style={{lineHeight:1.7}}>Consulte as empresas no próprio mapa. O cálculo usa a malha viária, mantém a primeira empresa como início ou utiliza o GPS, caso autorizado, e sugere a ordem das demais, sem considerar trânsito em tempo real.</p>
 <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'18px 0'}}>
 <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:13}}><input type="checkbox" checked={useGps} onChange={e=>setUseGps(e.target.checked)}/> Usar minha localização como início</label>
 <button className="button" disabled={calculating||loading||!stops.length} onClick={()=>void optimize()}>{calculating?<RefreshCw size={16}/>:<RouteIcon size={16}/>} {calculating?'Calculando percurso...':data?'Recalcular melhor trajeto':'Calcular melhor trajeto'}</button>
 {data&&data.distance_m!==null&&data.duration_s!==null&&<><span className="pill">{fmtDistance(data.distance_m)}</span><span className="pill">{fmtDuration(data.duration_s)} estimados em movimento</span></>}
 </div>
 {calculating&&<p className="muted" role="status" style={{marginBottom:12}}>{progress}</p>}
 {routeError&&<div className="notice" role="alert">{routeError}</div>}
 {data?.route_warning&&<div className="notice" role="alert" style={{marginBottom:14}}>{data.route_warning}</div>}
 {data?.partial&&<div style={{padding:16,marginBottom:16,border:'1px solid #edcfa7',borderRadius:12,background:'#fff9ee'}} role="status"><strong>Percurso parcial: {data.located} de {data.total} empresas localizadas.</strong><p style={{fontSize:13,margin:'8px 0'}}>As empresas abaixo continuam na lista de trabalho, mas não fazem parte do trajeto desenhado. Verifique suas coordenadas antes de usar este percurso como rota completa.</p><ul style={{paddingLeft:20,margin:'8px 0'}}>{(data.missing||[]).map(x=><li key={x.id} style={{marginBottom:7}}><strong>{x.name}</strong> — {x.address||'Endereço incompleto'}</li>)}</ul></div>}
 {data?<RouteMap data={data}/>:<div className="empty" style={{minHeight:260}}><div><MapPinned size={34} color="#6c957e"/><strong>Mapa do percurso</strong><p>{loading?'Carregando paradas...':'Clique em Calcular melhor trajeto para localizar as empresas, desenhar o percurso e sugerir a ordem de visita.'}</p></div></div>}
 {data&&<p className="muted" style={{marginTop:14}}>Tempo e distância são estimativas de deslocamento, sem duração das visitas, paradas ou trânsito ao vivo. Confira a localização dos estabelecimentos antes de sair.</p>}
 </section>
 <section className="panel"><div className="panel-title"><div><small>ETAPAS DO DIA</small><h2>{sorted.length} empresas na rota</h2></div><Link href="/visitas" className="button secondary"><Navigation size={16}/> Registrar visita</Link></div>
 <div className="roadmap-list">{sorted.map((s,i)=><div key={s.id}><span>{String(i+1).padStart(2,'0')}</span><p><strong>{s.trade_name||s.legal_name}</strong><br/><small>{[s.street,s.street_number,s.city,s.state].filter(Boolean).join(', ')} · CNPJ {s.cnpj}</small></p></div>)}</div>
 {!stops.length&&!loading&&!error&&<div className="empty">Não existem paradas nesta rota.</div>}
 </section>
 </Portal>;
}
