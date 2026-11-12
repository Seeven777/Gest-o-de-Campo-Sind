/** Diagnóstico territorial: distância em linha reta nunca equivale à distância ou ao tempo viário. */
export type Location={
 id:string;legal_name:string;trade_name?:string|null;city:string|null;district?:string|null;
 postal_code?:string|null;lat:number|null;lon:number|null
};
export type Candidate=Location&{
 same_city:boolean;same_district:boolean;similar_postal:boolean;
 nearest_km:number|null;reason:string
};
const normal=(s:string|null|undefined)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const postal=(s:string|null|undefined)=>String(s??'').replace(/\D/g,'');
const round=(n:number|null):number|null=>n===null?null:Math.round(n*10)/10;
export function kmBetween(a:Pick<Location,'lat'|'lon'>,b:Pick<Location,'lat'|'lon'>):number|null{
 const v=[a.lat,a.lon,b.lat,b.lon];
 if(v.some(x=>typeof x!=='number'||!Number.isFinite(x)))return null;
 const [lat1,lon1,lat2,lon2]=v as number[];
 if(Math.abs(lat1)>90||Math.abs(lat2)>90||Math.abs(lon1)>180||Math.abs(lon2)>180)return null;
 const r=Math.PI/180,dy=(lat2-lat1)*r,dx=(lon2-lon1)*r;
 const h=Math.sin(dy/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dx/2)**2;
 return 6371.0088*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function evaluateRoute(items:Location[]){
 const cities=new Map<string,{city:string;count:number}>();
 let knownLegs=0,knownKm=0,maxJump=0,maxSpan=0,located=0;
 for(let i=0;i<items.length;i++){
  const key=normal(items[i].city);
  if(key){const v=cities.get(key);if(v)v.count++;else cities.set(key,{city:items[i].city!.trim(),count:1})}
  if(items[i].lat!==null&&items[i].lon!==null&&Number.isFinite(Number(items[i].lat))&&Number.isFinite(Number(items[i].lon)))located++;
  if(i){const d=kmBetween(items[i-1],items[i]);if(d!==null){knownLegs++;knownKm+=d;maxJump=Math.max(maxJump,d)}}
  for(let j=0;j<i;j++){const d=kmBetween(items[j],items[i]);if(d!==null)maxSpan=Math.max(maxSpan,d)}
 }
 const risk=(knownLegs||located>1)?maxSpan>35||maxJump>25?'high':maxSpan>18||maxJump>12?'attention':'compact':'unknown';
 const warnings:string[]=[];
 if(risk==='high')warnings.push('Empresas muito afastadas entre si. Considere separar por região antes de publicar.');
 else if(risk==='attention')warnings.push('Algumas paradas estão dispersas. Considere empresas mais próximas.');
 if(cities.size>1)warnings.push('A seleção inclui '+cities.size+' municípios. Verifique se faz sentido atendê-los no mesmo dia.');
 if(located<items.length)warnings.push((items.length-located)+' empresa(s) sem coordenadas: a distância real não pode ser conferida integralmente.');
 if(items.length>20)warnings.push('Rota com muitas empresas. Reserve tempo para atendimento, pausas e deslocamentos.');
 return {selected:items.length,located,coverage:items.length?Math.round(located/items.length*100):0,
  known_legs:knownLegs,straight_leg_km:round(knownLegs?knownKm:null),
  max_jump_km:round(knownLegs?maxJump:null),span_km:round(located>1?maxSpan:null),risk,warnings,
  cities:[...cities.values()].sort((a,b)=>b.count-a.count),
  points:items.filter(x=>x.lat!==null&&x.lon!==null).map(x=>({id:x.id,lat:Number(x.lat),lon:Number(x.lon)}))};
}
export function rankCandidates(selected:Location[],possible:Location[],limit=12):Candidate[]{
 return possible.map(item=>{
  const c=normal(item.city),d=normal(item.district),code=postal(item.postal_code);
  const sameCity=!!c&&selected.some(s=>normal(s.city)===c);
  const sameDistrict=sameCity&&!!d&&selected.some(s=>normal(s.city)===c&&normal(s.district)===d);
  const similarPostal=sameCity&&code.length>=5&&selected.some(s=>normal(s.city)===c&&postal(s.postal_code).length>=5&&postal(s.postal_code).slice(0,5)===code.slice(0,5));
  const distances=selected.map(s=>kmBetween(item,s)).filter((x):x is number=>x!==null);
  const km=distances.length?Math.min(...distances):null;
  const reason=km!==null?'A '+round(km)+' km em linha reta':sameDistrict?'Mesmo bairro':similarPostal?'CEP semelhante':sameCity?'Mesmo município':'Região próxima';
  return {...item,same_city:sameCity,same_district:sameDistrict,similar_postal:similarPostal,nearest_km:round(km),reason};
 }).filter(x=>x.same_city||(x.nearest_km!==null&&x.nearest_km<=20))
 .sort((a,b)=>{
  const tier=(x:Candidate)=>x.nearest_km!==null&&x.nearest_km<=5?0:x.same_district?1:x.similar_postal?2:x.nearest_km!==null&&x.nearest_km<=20?3:x.same_city?4:5;
  return tier(a)-tier(b)||(a.nearest_km??9999)-(b.nearest_km??9999)||a.legal_name.localeCompare(b.legal_name,'pt-BR');
 }).slice(0,limit);
}
