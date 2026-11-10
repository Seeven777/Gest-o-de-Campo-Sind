import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
type Point={id:string;position_order:number;legal_name:string;trade_name:string|null;street:string|null;street_number:string|null;city:string|null;state:string|null;postal_code:string|null;cnpj:string;lat:number|null;lon:number|null};
type Coordinates=[number,number];

async function ors(url:string,init:RequestInit,token:string){
 const signal=AbortSignal.timeout(15000);
 const response=await fetch(url,{...init,signal,headers:{Authorization:token,Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
 if(!response.ok){const detail=(await response.text()).slice(0,250);throw new Error('Roteirizador indisponível (HTTP '+response.status+'): '+detail);}
 return response.json();
}
export const maxDuration=60;
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentIdentity();
 if(!user)return fail('Faça login para consultar o percurso.',401);
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return fail('Identificador da rota inválido.');
 const [route]=await db().query('select id,agent_id,status from routes where id=$1',[id]);
 if(!route||user.role==='agent'&&route.agent_id!==user.id)return fail('Rota não encontrada.',404);
 if(user.role==='agent'&&!['published','in_progress','completed'].includes(route.status))return fail('Esta rota ainda não foi liberada ao agente.',403);
 const raw=await db().query(`select s.id,s.position_order,e.legal_name,e.trade_name,e.street,e.street_number,e.city,e.state,e.postal_code,e.cnpj,
 ST_Y(e.position::geometry) as lat,ST_X(e.position::geometry) as lon
 from route_stops s join establishments e on e.id=s.establishment_id where s.route_id=$1 order by s.position_order`,[id]);
 const stops=raw as Point[];
 if(!stops.length)return fail('A rota ainda não possui paradas.');
 const body=await req.json().catch(()=>({}));
 const start=body.start;
 const origin=(start&&Number.isFinite(start.lat)&&Number.isFinite(start.lon)&&Math.abs(start.lat)<=90&&Math.abs(start.lon)<=180)?[Number(start.lon),Number(start.lat)] as Coordinates:null;
 const token=process.env.OPENROUTESERVICE_API_KEY;
 if(!token)return fail('O mapa otimizado precisa da variável OPENROUTESERVICE_API_KEY na Vercel.',503);
 // Geocodificação pontual e sob demanda, limitada para evitar consumo excessivo de créditos.
 let geocoded=0;
 const missing:string[]=[];
 for(const stop of stops){
  if(stop.lat!==null&&stop.lon!==null&&Number.isFinite(Number(stop.lat))&&Number.isFinite(Number(stop.lon)))continue;
  if(geocoded>=8){missing.push(stop.legal_name);continue}
  const query=[stop.street,stop.street_number,stop.city,stop.state,stop.postal_code,'Brasil'].filter(Boolean).join(', ');
  if(!stop.street||!stop.city){missing.push(stop.legal_name);continue}
  try{
   const url='https://api.openrouteservice.org/geocode/search?'+new URLSearchParams({text:query,size:'1','boundary.country':'BRA'});
   const result=await ors(url,{},token);
   const coords=result?.features?.[0]?.geometry?.coordinates as number[]|undefined;
   if(!coords||!Number.isFinite(coords[0])||!Number.isFinite(coords[1])){missing.push(stop.legal_name);continue}
   stop.lon=coords[0];stop.lat=coords[1];geocoded++;
   // Coordenadas aproximadas para reutilização nas próximas consultas.
   await db().query('update establishments set position=ST_SetSRID(ST_MakePoint($2,$3),4326)::geography where id=(select establishment_id from route_stops where id=$1) and position is null',[stop.id,stop.lon,stop.lat]);
  }catch{missing.push(stop.legal_name)}
 }
 if(missing.length)return NextResponse.json({error:'Ainda faltam coordenadas para '+missing.length+' empresas. Confira os endereços e execute o cálculo novamente. É possível localizar até 8 novos endereços por execução.',missing,geocoded},{status:422});
 const coords=stops.map(s=>[Number(s.lon),Number(s.lat)] as Coordinates);
 if(coords.length===1&&!origin)return NextResponse.json({order:[stops[0].id],points:stops.map(s=>({id:s.id,lat:Number(s.lat),lon:Number(s.lon)})),geometry:{type:'LineString',coordinates:coords},distance_m:0,duration_s:0,estimated:true,geocoded});
 try{
  // O primeiro endereço é o ponto inicial. Os demais são otimizados pelo serviço VROOM.
  const jobCoords=origin?coords:coords.slice(1);
  const optimization=await ors('https://api.openrouteservice.org/optimization',{
   method:'POST',body:JSON.stringify({jobs:jobCoords.map((location,i)=>({id:i+1,location})),vehicles:[{id:1,profile:'driving-car',start:origin||coords[0]}]})
  },token);
  const best=optimization?.routes?.[0]?.steps?.filter((s:{type:string})=>s.type==='job').map((s:{id:number})=>Number(s.id));
  if(!Array.isArray(best)||best.length!==jobCoords.length||optimization.unassigned?.length)return fail('A otimização não conseguiu incluir todas as paradas.',422);
  const indices=origin?best.map((i:number)=>i-1):[0,...best];
  if(new Set(indices).size!==stops.length||indices.some((i:number)=>i<0||i>=stops.length))return fail('A sequência otimizada retornou paradas inválidas.',502);
  const sorted=origin?[origin,...indices.map((i:number)=>coords[i])]:indices.map((i:number)=>coords[i]);
  const directions=await ors('https://api.openrouteservice.org/v2/directions/driving-car/geojson',
   {method:'POST',body:JSON.stringify({coordinates:sorted,instructions:false})},token);
  const feature=directions?.features?.[0],geometry=feature?.geometry;
  if(!geometry||geometry.type!=='LineString'||!Array.isArray(geometry.coordinates))return fail('Não foi possível desenhar o trajeto pelas ruas.',502);
  const summary=feature.properties?.summary??{};
  return NextResponse.json({order:indices.map((i:number)=>stops[i].id),points:stops.map(s=>({id:s.id,lat:Number(s.lat),lon:Number(s.lon)})),origin:origin?{lat:origin[1],lon:origin[0]}:null,geometry,distance_m:Number(summary.distance||0),duration_s:Number(summary.duration||0),estimated:true,geocoded},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('[otimizar rota]',e instanceof Error?e.message:e);return fail('Não foi possível calcular a rota. Confira a chave e os limites da API de roteirização.',502)}
}
