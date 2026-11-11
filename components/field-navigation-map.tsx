'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
export type FieldPoint={id:string;lat:number;lon:number};
export type FieldPlan={order:string[];points:FieldPoint[];geometry:{type:'LineString';coordinates:[number,number][]};route_warning?:string;partial?:boolean;missing?:{id:string;name:string;address:string}[];distance_m?:number|null;duration_s?:number|null};
export type CurrentPosition={lat:number;lon:number;accuracy:number;heading?:number|null;speed?:number|null};
export type RouteStep={instruction:string;type:number;distance_m:number;duration_s:number;at:[number,number];route_index:number};
export type ActiveLeg={geometry:{type:'LineString';coordinates:[number,number][]};steps:RouteStep[];distance_m:number;duration_s:number;estimated:true};
type LMap={remove:()=>void;fitBounds:(b:unknown,o?:unknown)=>void;setView:(c:number[],zoom:number,o?:unknown)=>void;invalidateSize:()=>void;
 panTo:(c:number[],o?:unknown)=>void;panBy:(offset:number[],o?:unknown)=>void;on:(ev:string,fn:()=>void)=>void;off:(ev:string,fn:()=>void)=>void;zoomIn:()=>void;zoomOut:()=>void};
type Layer={addTo:(m:unknown)=>Layer;bindTooltip:(text:string)=>Layer;setLatLng:(v:number[])=>void;setIcon:(icon:unknown)=>void;remove:()=>void;setRadius?:(radius:number)=>void};
type LApi={map:(e:HTMLElement,o:unknown)=>LMap;tileLayer:(v:string,o:unknown)=>Layer;marker:(v:number[],o:unknown)=>Layer;divIcon:(o:unknown)=>unknown;polyline:(v:number[][],o:unknown)=>Layer;circle:(v:number[],o:unknown)=>Layer;latLngBounds:(v:number[][])=>unknown};
let loading:Promise<LApi>|null=null;
function leaflet(){
 if(typeof window==='undefined')return Promise.reject(Error('Mapa disponível apenas no navegador.'));
 const w=window as typeof window&{L?:LApi};
 if(w.L)return Promise.resolve(w.L);
 if(loading)return loading;
 loading=new Promise<LApi>((resolve,reject)=>{
  if(!document.querySelector('link[data-field-leaflet]')){
   const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.fieldLeaflet='1';document.head.appendChild(css);
  }
  const existing=document.querySelector('script[data-field-leaflet]') as HTMLScriptElement|null;
  const js=existing||document.createElement('script');
  const resolveLoaded=()=>w.L?resolve(w.L):reject(Error('Falha ao iniciar o mapa.'));
  if(existing){js.addEventListener('load',resolveLoaded,{once:true});js.addEventListener('error',()=>reject(Error('Sem conexão para carregar o mapa.')),{once:true})}
  else{js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.async=true;js.dataset.fieldLeaflet='1';js.onload=resolveLoaded;js.onerror=()=>reject(Error('Sem conexão para carregar o mapa.'));document.head.appendChild(js)}
 }).catch(e=>{loading=null;throw e});
 return loading;
}
type Props={
 plan:FieldPlan;targetId?:string;current?:CurrentPosition|null;follow?:boolean;
 compact?:boolean;kind?:'stop'|'agent';immersive?:boolean;recenterToken?:number;fitToken?:number;zoomCommand?:{id:number;delta:1|-1};
 completedIds?:string[];activeLeg?:ActiveLeg|null;onManualPan?:()=>void;
};
const validPoints=(pts:[number,number][]|undefined)=>pts?.filter(c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])).map(([lon,lat])=>[lat,lon])||[];
function markerIcon(L:LApi,label:string,state:'done'|'active'|'next'|'agent'){
 return L.divIcon({className:'field-pin field-pin-'+state,html:'<span>'+label+'</span>',iconSize:[40,40],iconAnchor:[20,20]});
}
const gpsIcon=(L:LApi,heading:number|null|undefined)=>L.divIcon({
 className:'field-position-dot',html:'<span class="field-position-arrow" style="transform:rotate('+((heading??0)+0)+'deg)"></span>',
 iconSize:[38,38],iconAnchor:[19,19]
});
export function FieldNavigationMap({plan,targetId,current,follow=true,compact=false,kind='stop',immersive=false,recenterToken=0,fitToken=0,zoomCommand,completedIds=[],activeLeg,onManualPan}:Props){
 const element=useRef<HTMLDivElement|null>(null),map=useRef<LMap|null>(null),gpsMarker=useRef<Layer|null>(null),gpsAccuracy=useRef<Layer|null>(null),
  leafletApi=useRef<LApi|null>(null),markers=useRef(new Map<string,Layer>()),legLayer=useRef<Layer|null>(null),legOutline=useRef<Layer|null>(null),
  lastCenter=useRef(0),callback=useRef(onManualPan);
 useEffect(()=>{callback.current=onManualPan},[onManualPan]);
 const [error,setError]=useState(''),[ready,setReady]=useState(false);
 const completedKey=completedIds.join(',');
 const target=useMemo(()=>plan.points.find(p=>p.id===targetId),[plan.points,targetId]);
 const pos=useRef(current);useEffect(()=>{pos.current=current},[current]);
 const targetRef=useRef(target);useEffect(()=>{targetRef.current=target},[target]);
 const makeBounds=(pts:number[][],instance:LMap,L:LApi)=>{
  if(pts.length>1){
   const mobile=window.innerWidth<=800;
   const viewport=element.current?.clientHeight||window.innerHeight;
   const top=mobile?Math.min(172,viewport*.24):120;
   const bottom=mobile?Math.min(290,viewport*.4):220;
   instance.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[25,top],paddingBottomRight:[25,bottom],maxZoom:16,animate:true});
  }else if(pts.length===1)instance.setView(pts[0],15);
 };
 useEffect(()=>{
  let disposed=false;setReady(false);setError('');
  leaflet().then(L=>{
   if(disposed||!element.current)return;
   leafletApi.current=L;
   const instance=L.map(element.current,{zoomControl:!immersive,scrollWheelZoom:!immersive,preferCanvas:true,attributionControl:true});
   map.current=instance;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19,keepBuffer:3}).addTo(instance);
   for(let i=0;i<plan.order.length;i++){
    const p=plan.points.find(x=>x.id===plan.order[i]);if(!p)continue;
    markers.current.set(p.id,L.marker([p.lat,p.lon],{icon:markerIcon(L,String(i+1),kind==='agent'?'agent':'next')}).addTo(instance).bindTooltip((kind==='agent'?'Agente ':'Parada ')+(i+1)));
   }
   const route=validPoints(plan.geometry?.coordinates);
   if(route.length>=2)L.polyline(route,{color:'#385d4e',weight:5,opacity:.37,dashArray:'9 12'}).addTo(instance);
   const panListener=()=>callback.current?.();
   instance.on('dragstart',panListener);
   let observer:ResizeObserver|undefined;
   if(typeof ResizeObserver!=='undefined'){
    observer=new ResizeObserver(()=>{if(!disposed)instance.invalidateSize()});
    observer.observe(element.current);
   }
   const all=plan.points.map(p=>[p.lat,p.lon]);
   window.requestAnimationFrame(()=>{if(!disposed){instance.invalidateSize();makeBounds(all.length?all:route,instance,L);setReady(true)}});
   return ()=>{instance.off('dragstart',panListener);observer?.disconnect()};
  }).then(cleanup=>{if(disposed)cleanup?.();else cleanupRef.current=cleanup||null}).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'Falha no mapa')});
  return()=>{disposed=true;cleanupRef.current?.();cleanupRef.current=null;map.current?.remove();map.current=null;lastCenter.current=0;gpsMarker.current=null;gpsAccuracy.current=null;legLayer.current=null;legOutline.current=null;markers.current.clear();leafletApi.current=null};
 // A montagem do mapa depende da rota, mas não deve reiniciar a cada ping, alteração de etapa ou check-in.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[plan,kind,immersive]);
 const cleanupRef=useRef<null|(()=>void)>(null);
 useEffect(()=>{
  if(!ready||!leafletApi.current)return;
  const L=leafletApi.current,done=new Set(completedIds);
  for(let i=0;i<plan.order.length;i++){
   const item=markers.current.get(plan.order[i]);if(!item)continue;
   const state=kind==='agent'?'agent':done.has(plan.order[i])?'done':plan.order[i]===targetId?'active':'next';
   item.setIcon(markerIcon(L,done.has(plan.order[i])?'✓':String(i+1),state));
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,completedKey,targetId,kind,plan]);
 useEffect(()=>{
  if(!ready||!map.current||!leafletApi.current)return;
  legLayer.current?.remove();legLayer.current=null;legOutline.current?.remove();legOutline.current=null;
  const pts=validPoints(activeLeg?.geometry?.coordinates);
  if(pts.length>=2){
   const L=leafletApi.current,instance=map.current;
   legOutline.current=L.polyline(pts,{color:'#fff',weight:11,opacity:.98}).addTo(instance);
   legLayer.current=L.polyline(pts,{color:'#f26a21',weight:7,opacity:1}).addTo(instance);
  }
 },[ready,activeLeg]);
 useEffect(()=>{
  if(!ready||!map.current||!leafletApi.current||!current)return;
  const L=leafletApi.current,instance=map.current,latlng=[current.lat,current.lon];
  if(!gpsMarker.current)gpsMarker.current=L.marker(latlng,{icon:gpsIcon(L,current.heading)}).addTo(instance);
  else{gpsMarker.current.setLatLng(latlng);gpsMarker.current.setIcon(gpsIcon(L,current.heading))}
  if(!gpsAccuracy.current)gpsAccuracy.current=L.circle(latlng,{radius:Math.max(15,Math.min(300,current.accuracy)),weight:1,color:'#267bcb',fillColor:'#458adc',fillOpacity:.1}).addTo(instance);
  else {gpsAccuracy.current.setLatLng(latlng);gpsAccuracy.current.setRadius?.(Math.max(15,Math.min(300,current.accuracy)))}
  if(follow&&Date.now()-lastCenter.current>1800){
   if(!lastCenter.current)instance.setView(latlng,16,{animate:false});
   else instance.panTo(latlng,{animate:true,duration:.35});
   lastCenter.current=Date.now();
  }
 },[ready,current,follow]);
 useEffect(()=>{
  if(!ready||!map.current||!leafletApi.current)return;
  const currentPos=pos.current,targetNow=targetRef.current,L=leafletApi.current,instance=map.current;
  const points:number[][]=[];
  if(currentPos)points.push([currentPos.lat,currentPos.lon]);
  if(targetNow)points.push([targetNow.lat,targetNow.lon]);
  else points.push(...plan.points.map(p=>[p.lat,p.lon]));
  makeBounds(points,instance,L);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,recenterToken,targetId]);
 useEffect(()=>{
  if(!ready||!map.current||!leafletApi.current||fitToken===0)return;
  const route=validPoints(plan.geometry?.coordinates);
  makeBounds(route.length?route:plan.points.map(p=>[p.lat,p.lon]),map.current,leafletApi.current);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[fitToken,ready]);
 useEffect(()=>{
  if(!ready||!map.current||!zoomCommand)return;
  if(zoomCommand.delta===1)map.current.zoomIn();else map.current.zoomOut();
 },[zoomCommand,ready]);
 return <div className={'field-map-wrap'+(immersive?' field-map-wrap-immersive':'')}>
  {error&&<p role="alert" className="field-warning" style={{position:'absolute',zIndex:1100,top:12,left:12,right:12}}>{error}</p>}
  <div ref={element} className={'field-map'+(immersive?' field-map-immersive':compact?' field-map-compact':'')}
   role="region" aria-label={kind==='agent'?'Mapa de acompanhamento dos agentes':'Mapa interativo com as paradas, rota viária e posição atual. Arraste para explorar e use Centralizar para retomar o GPS.'}/>
  <style jsx global>{`.field-pin{background:#f36b24;color:white;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 12px #0004;font-weight:800;text-align:center;line-height:34px;font-size:16px}.field-pin-active{background:#17583d;box-shadow:0 0 0 6px #ff9f605e,0 3px 12px #0004}.field-pin-done{background:#7a8e83}.field-pin-agent{background:#1f76d2}.field-position-dot{border-radius:50%;background:#327cda4f;padding:5px;box-sizing:border-box;box-shadow:0 2px 12px #255f9a88}.field-position-dot .field-position-arrow{display:block;width:100%;height:100%;background:#2675d9;border:3px solid #fff;border-radius:50%;position:relative}.field-position-dot .field-position-arrow:after{content:'';position:absolute;width:8px;height:10px;background:#fff;clip-path:polygon(50% 0,0 100%,100% 100%);left:50%;top:4px;transform:translateX(-50%)}.field-map-wrap-immersive .leaflet-container{touch-action:pan-x pan-y}`}</style>
 </div>;
}
