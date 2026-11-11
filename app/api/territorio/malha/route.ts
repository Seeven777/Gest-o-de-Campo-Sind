import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
export const dynamic='force-dynamic';
const source='https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-35-mun.json';
export async function GET(){
 const user=await currentIdentity();
 if(!user)return NextResponse.json({error:'Sessão expirada.'},{status:401});
 if(!['admin','supervisor'].includes(user.role))return NextResponse.json({error:'Acesso restrito.'},{status:403});
 try{
  const response=await fetch(source,{next:{revalidate:86400},signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error('Falha ao buscar a malha municipal.');
  const value=await response.json() as {type?:string;features?:unknown[]};
  if(value.type!=='FeatureCollection'||!Array.isArray(value.features)||value.features.length!==645)throw Error('O arquivo geográfico não contém os 645 municípios.');
  return NextResponse.json(value,{headers:{'Cache-Control':'private, max-age=3600','X-Geodata-Source':'IBGE via geodata-br'}});
 }catch(e){
  console.error('[malha SP]',e);
  return NextResponse.json({error:'A malha dos municípios está indisponível no momento. Tente novamente.'},{status:503});
 }
}
