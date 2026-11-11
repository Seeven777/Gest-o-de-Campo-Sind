import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f-]{36}$/i;
type Step={instruction:string;type:number;distance_m:number;duration_s:number;at:[number,number];route_index:number};
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const u=await currentIdentity();
 if(!u||u.role!=='agent')return fail('Acesso restrito ao agente autorizado.',403);
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const {id}=await params;
 if(!uuid.test(id))return fail('Rota inválida.');
 const body=await req.json().catch(()=>({})) as Record<string,unknown>;
 const stopId=String(body.stop_id||'');
 const lat=body.lat,lon=body.lon;
 if(!uuid.test(stopId)||typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
  return fail('Localização ou parada inválida.');
 const [target]=await db().query(`select st_y(e.position::geometry) as lat,st_x(e.position::geometry) as lon
 from route_stops s join routes r on r.id=s.route_id join establishments e on e.id=s.establishment_id
 where s.id=$1 and s.route_id=$2 and r.agent_id=$3 and r.status in ('published','in_progress')`,[stopId,id,u.id]);
 if(!target)return fail('Esta empresa não pertence à sua rota.',403);
 if(target.lat===null||target.lon===null)return fail('Empresa sem coordenadas cadastradas.',422);
 const endLat=Number(target.lat),endLon=Number(target.lon);
 if(!Number.isFinite(endLat)||!Number.isFinite(endLon))return fail('Endereço sem coordenadas válidas.',422);
 const key=process.env.OPENROUTESERVICE_API_KEY;
 if(!key)return fail('Serviço de navegação não configurado.',503);
 try{
  const res=await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson',{
   method:'POST',
   headers:{Authorization:key,Accept:'application/geo+json','Content-Type':'application/json'},
   body:JSON.stringify({coordinates:[[lon,lat],[endLon,endLat]],language:'pt',instructions:true,instructions_format:'text'}),
   signal:AbortSignal.timeout(17000),cache:'no-store'
  });
  if(!res.ok){console.error('[field leg routing]',res.status);return fail(res.status===429?'O serviço de mapas atingiu seu limite. Tente novamente mais tarde.':'Não foi possível calcular o trecho agora.',503)}
  const response=await res.json() as {features?:{geometry?:{type?:string;coordinates?:unknown};properties?:{summary?:{distance?:number;duration?:number};segments?:{steps?:{instruction?:string;type?:number;distance?:number;duration?:number;way_points?:number[]}[]}[]}}[]};
  const feat=response.features?.[0];const coords=feat?.geometry?.coordinates;
  if(feat?.geometry?.type!=='LineString'||!Array.isArray(coords)||coords.length<2||coords.length>120000)return fail('O provedor não retornou um trajeto válido.',503);
  const geometry=coords.filter((p):p is number[]=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])).map(p=>[p[0],p[1]] as [number,number]);
  if(geometry.length<2)return fail('O provedor retornou uma rota inválida.',503);
  const raw=feat.properties?.segments?.flatMap(s=>s.steps||[])||[];
  const steps:Step[]=raw.slice(0,350).map(s=>{
   const index=Math.max(0,Math.min(geometry.length-1,Number(s.way_points?.[0]??0)||0));
   return {instruction:String(s.instruction||'Siga em frente').slice(0,220),
    type:Number.isFinite(s.type)?Number(s.type):6,route_index:index,
    distance_m:Number(s.distance||0),duration_s:Number(s.duration||0),
    at:geometry[index]};
  });
  return NextResponse.json({geometry:{type:'LineString',coordinates:geometry},
   steps,distance_m:Number(feat.properties?.summary?.distance||0),
   duration_s:Number(feat.properties?.summary?.duration||0),estimated:true},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('[field leg routing]',e instanceof Error?e.name:'unknown');
  return fail('O serviço de rotas está indisponível. O mapa de paradas continua acessível.',503);
 }
}
