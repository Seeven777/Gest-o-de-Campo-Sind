'use client';
import {useEffect,useRef,useState} from 'react';
export type FieldPoint={id:string;lat:number;lon:number};
export type FieldPlan={order:string[];points:FieldPoint[];geometry:{type:'LineString';coordinates:[number,number][]};route_warning?:string;partial?:boolean;missing?:{id:string;name:string;address:string}[]};
export type CurrentPosition={lat:number;lon:number;accuracy:number};
type LMap={remove:()=>void;fitBounds:(b:unknown,o?:unknown)=>void;setView:(c:number[],zoom:number)=>void};
type Layer={addTo:(m:unknown)=>Layer;bindTooltip:(text:string)=>Layer;setLatLng:(v:number[])=>void};
type LApi={map:(e:HTMLElement,o:unknown)=>LMap;tileLayer:(v:string,o:unknown)=>Layer;marker:(v:number[],o:unknown)=>Layer;divIcon:(o:unknown)=>unknown;polyline:(v:number[][],o:unknown)=>Layer;latLngBounds:(v:number[][])=>unknown};
let loading:Promise<LApi>|null=null;
function leaflet(){
 if(typeof window==='undefined')return Promise.reject(Error('Mapa disponível apenas no navegador.'));
 const w=window as typeof window&{L?:LApi};
 if(w.L)return Promise.resolve(w.L);
 if(loading)return loading;
 loading=new Promise<LApi>((resolve,reject)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);
  const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.async=true;
  js.onload=()=>w.L?resolve(w.L):reject(Error('Falha ao iniciar mapa.'));
  js.onerror=()=>reject(Error('Sem conexão para carregar o mapa.'));
  document.head.appendChild(js);
 }).catch(e=>{loading=null;throw e});
 return loading;
}
export function FieldNavigationMap({plan,targetId,current,follow=true,compact=false}:{plan:FieldPlan;targetId?:string;current?:CurrentPosition|null;follow?:boolean;compact?:boolean}){
 const element=useRef<HTMLDivElement|null>(null),map=useRef<LMap|null>(null),gpsMarker=useRef<Layer|null>(null),leafletApi=useRef<LApi|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let disposed=false;setError('');
  leaflet().then(L=>{
   if(disposed||!element.current)return;
   leafletApi.current=L;
   const instance=L.map(element.current,{zoomControl:true,scrollWheelZoom:false});map.current=instance;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(instance);
   const pts:number[][]=[];
   for(let i=0;i<plan.order.length;i++){
    const p=plan.points.find(x=>x.id===plan.order[i]);if(!p)continue;
    pts.push([p.lat,p.lon]);
    const icon=L.divIcon({className:p.id===targetId?'field-pin field-pin-active':'field-pin',html:'<span>'+String(i+1)+'</span>',iconSize:[38,38],iconAnchor:[19,19]});
    L.marker([p.lat,p.lon],{icon}).addTo(instance).bindTooltip('Empresa '+(i+1));
   }
   const line=plan.geometry?.coordinates?.map(([lon,lat])=>[lat,lon])||[];
   if(line.length>=2)L.polyline(line,{color:'#f26522',weight:6,opacity:.94}).addTo(instance);
   if(pts.length)instance.fitBounds(L.latLngBounds(pts),{padding:[38,38],maxZoom:15});
   if(targetId){const t=plan.points.find(x=>x.id===targetId);if(t)instance.setView([t.lat,t.lon],15)}
   if(current){
    const icon=L.divIcon({className:'field-position-dot',html:'<span></span>',iconSize:[27,27],iconAnchor:[14,14]});
    gpsMarker.current=L.marker([current.lat,current.lon],{icon}).addTo(instance);
   }
  }).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'Falha no mapa')});
  return()=>{disposed=true;map.current?.remove();map.current=null;gpsMarker.current=null;leafletApi.current=null}
 // Quando o destino muda, atualiza os pins. Atualizações periódicas de GPS NÃO recriam o mapa.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[plan,targetId]);
 useEffect(()=>{
  if(!map.current||!leafletApi.current||!current)return;
  if(!gpsMarker.current){
   const icon=leafletApi.current.divIcon({className:'field-position-dot',html:'<span></span>',iconSize:[27,27],iconAnchor:[14,14]});
   gpsMarker.current=leafletApi.current.marker([current.lat,current.lon],{icon}).addTo(map.current);
  }else gpsMarker.current.setLatLng([current.lat,current.lon]);
  if(follow)map.current.setView([current.lat,current.lon],16);
 },[current,follow]);
 return <div className="field-map-wrap">
  {error&&<p role="alert" className="field-warning">{error}</p>}
  <div ref={element} className={compact?'field-map field-map-compact':'field-map'} role="img" aria-label="Mapa com a ordem de visitas, ruas e posição atual do agente"/>
  <style jsx global>{`.field-pin{background:#f36b24;color:white;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 12px #0004;font-weight:800;text-align:center;line-height:32px;font-size:15px}.field-pin-active{background:#155842;box-shadow:0 0 0 5px #f7caa4,0 3px 12px #0004}.field-position-dot{border-radius:50%;background:#327cda55;padding:5px;box-sizing:border-box}.field-position-dot span{display:block;width:100%;height:100%;background:#2675d9;border:2px solid #fff;border-radius:50%}`}</style>
 </div>;
}
