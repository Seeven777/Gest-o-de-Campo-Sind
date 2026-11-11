'use client';
import {useEffect,useRef,useState} from 'react';
export type FieldPoint={id:string;lat:number;lon:number};
export type FieldPlan={order:string[];points:FieldPoint[];geometry:{type:'LineString';coordinates:[number,number][]};route_warning?:string;partial?:boolean;missing?:{id:string;name:string;address:string}[];distance_m?:number|null;duration_s?:number|null};
export type CurrentPosition={lat:number;lon:number;accuracy:number};
type LMap={remove:()=>void;fitBounds:(b:unknown,o?:unknown)=>void;setView:(c:number[],zoom:number)=>void;invalidateSize:()=>void};
type Layer={addTo:(m:unknown)=>Layer;bindTooltip:(text:string)=>Layer;setLatLng:(v:number[])=>void};
type LApi={map:(e:HTMLElement,o:unknown)=>LMap;tileLayer:(v:string,o:unknown)=>Layer;marker:(v:number[],o:unknown)=>Layer;divIcon:(o:unknown)=>unknown;polyline:(v:number[][],o:unknown)=>Layer;latLngBounds:(v:number[][])=>unknown};
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
 compact?:boolean;kind?:'stop'|'agent';immersive?:boolean;recenterToken?:number;
 completedIds?:string[];
};
export function FieldNavigationMap({plan,targetId,current,follow=true,compact=false,kind='stop',immersive=false,recenterToken=0,completedIds=[]}:Props){
 const element=useRef<HTMLDivElement|null>(null),map=useRef<LMap|null>(null),gpsMarker=useRef<Layer|null>(null),leafletApi=useRef<LApi|null>(null);
 const [error,setError]=useState('');
 const completedKey=completedIds.join(',');
 const target=plan.points.find(p=>p.id===targetId);
 useEffect(()=>{
  let disposed=false;
  leaflet().then(L=>{
   if(disposed||!element.current)return;
   leafletApi.current=L;
   const instance=L.map(element.current,{zoomControl:!immersive,scrollWheelZoom:false});map.current=instance;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(instance);
   const pts:number[][]=[],done=new Set(completedKey?completedKey.split(','):[]);
   for(let i=0;i<plan.order.length;i++){
    const p=plan.points.find(x=>x.id===plan.order[i]);if(!p)continue;
    pts.push([p.lat,p.lon]);
    const active=p.id===targetId,completed=done.has(p.id);
    const icon=L.divIcon({
     className:kind==='agent'?'field-pin field-pin-agent':active?'field-pin field-pin-active':completed?'field-pin field-pin-done':'field-pin',
     html:'<span>'+(completed?'✓':String(i+1))+'</span>',iconSize:[40,40],iconAnchor:[20,20]
    });
    L.marker([p.lat,p.lon],{icon}).addTo(instance).bindTooltip((kind==='agent'?'Agente ':'Parada ')+(i+1));
   }
   const line=plan.geometry?.coordinates?.map(([lon,lat])=>[lat,lon])||[];
   if(line.length>=2){
    L.polyline(line,{color:'#ffffff',weight:11,opacity:.88}).addTo(instance);
    L.polyline(line,{color:'#f26a25',weight:6,opacity:.95}).addTo(instance);
   }
   if(current){
    const icon=L.divIcon({className:'field-position-dot',html:'<span></span>',iconSize:[32,32],iconAnchor:[16,16]});
    gpsMarker.current=L.marker([current.lat,current.lon],{icon}).addTo(instance);
   }
   const focused=target?[[target.lat,target.lon]]:[];
   if(current)focused.push([current.lat,current.lon]);
   const bounds=focused.length>=2?focused:(target?focused:(line.length?line:pts));
   if(bounds.length>1)instance.fitBounds(L.latLngBounds(bounds),{padding:[55,55],maxZoom:15});
   else if(bounds.length===1)instance.setView(bounds[0],15);
   window.requestAnimationFrame(()=>{if(!disposed)instance.invalidateSize()});
  }).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'Falha no mapa')});
  return()=>{disposed=true;map.current?.remove();map.current=null;gpsMarker.current=null;leafletApi.current=null};
  // Apenas mudança da parada/cálculo recria o mapa; pings de GPS não.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[plan,targetId,kind,immersive,completedKey]);
 useEffect(()=>{
  if(!map.current||!leafletApi.current||!current)return;
  if(!gpsMarker.current){
   const icon=leafletApi.current.divIcon({className:'field-position-dot',html:'<span></span>',iconSize:[32,32],iconAnchor:[16,16]});
   gpsMarker.current=leafletApi.current.marker([current.lat,current.lon],{icon}).addTo(map.current);
  }else gpsMarker.current.setLatLng([current.lat,current.lon]);
  if(follow)map.current.setView([current.lat,current.lon],16);
 },[current,follow]);
 useEffect(()=>{
  if(!map.current)return;
  if(current&&target){
   map.current.fitBounds(leafletApi.current!.latLngBounds([[current.lat,current.lon],[target.lat,target.lon]]),{padding:[64,64],maxZoom:16});
  }else if(current)map.current.setView([current.lat,current.lon],16);
  else if(target)map.current.setView([target.lat,target.lon],15);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[recenterToken]);
 return <div className={'field-map-wrap'+(immersive?' field-map-wrap-immersive':'')}>
  {error&&<p role="alert" className="field-warning" style={{position:'absolute',zIndex:1100,top:12,left:12,right:12}}>{error}</p>}
  <div ref={element} className={'field-map'+(immersive?' field-map-immersive':compact?' field-map-compact':'')}
   role="img" aria-label={kind==='agent'?'Mapa dos agentes compartilhando localização':'Mapa de visitas com paradas numeradas, trajeto pelas ruas quando disponível e sua posição atual.'}/>
  <style jsx global>{`.field-pin{background:#f36b24;color:white;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 12px #0004;font-weight:800;text-align:center;line-height:34px;font-size:16px}.field-pin-active{background:#17583d;box-shadow:0 0 0 6px #ff9f605e,0 3px 12px #0004}.field-pin-done{background:#7a8e83}.field-pin-agent{background:#1f76d2}.field-position-dot{border-radius:50%;background:#327cda55;padding:5px;box-sizing:border-box;box-shadow:0 2px 12px #255f9a88}.field-position-dot span{display:block;width:100%;height:100%;background:#2675d9;border:3px solid #fff;border-radius:50%}`}</style>
 </div>;
}
