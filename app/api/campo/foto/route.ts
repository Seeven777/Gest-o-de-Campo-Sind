import {NextResponse} from 'next/server';
import {put,del} from '@vercel/blob';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
const bad=(error:string,status=400)=>NextResponse.json({error},{status});
const uuid=/^[0-9a-f-]{36}$/i;
export async function POST(req:Request){
 const u=await currentIdentity();if(!u||u.role!=='agent')return bad('Apenas o agente designado pode enviar a foto.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return bad('Origem não autorizada.',403);
 const form=await req.formData().catch(()=>null);
 const visitId=form?.get('visit_id');const image=form?.get('photo');
 if(typeof visitId!=='string'||!uuid.test(visitId)||!(image instanceof File))return bad('Selecione a foto da fachada.');
 if(image.type!=='image/jpeg'||image.size<1024||image.size>2*1024*1024)return bad('Envie uma imagem JPEG de até 2 MB.');
 const bytes=new Uint8Array(await image.slice(0,4).arrayBuffer());
 if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)return bad('Formato de imagem inválido.');
 const [v]=await db().query(`select v.id from visits v join route_stops s on s.id=v.stop_id join routes r on r.id=s.route_id
 where v.id=$1 and v.agent_id=$2 and r.agent_id=$2 and v.checkin_at is not null
 and v.checkout_at is null and r.status in ('published','in_progress')`,[visitId,u.id]);
 if(!v)return bad('Chegada não registrada ou visita já concluída.',403);
 const [existing]=await db().query('select id from visit_evidence where visit_id=$1 and deleted_at is null limit 1',[visitId]);
 if(existing)return bad('A visita já possui uma fotografia. Não envie novamente.',409);
 let pathname='';
 try{
  const blob=await put('visitas/'+visitId+'/'+crypto.randomUUID()+'.jpg',image,{access:'private',contentType:'image/jpeg',addRandomSuffix:false});
  pathname=blob.pathname;
  const [row]=await db().query(`insert into visit_evidence(visit_id,storage_key,mime_type,expires_at) values($1,$2,'image/jpeg',now()+interval '14 days') returning id`,[visitId,pathname]);
  return NextResponse.json({id:row.id,ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(pathname)await del(pathname).catch(()=>{});
  console.error('[foto] falha de upload privado',e instanceof Error?e.message:'falha');
  return bad('Não foi possível armazenar a foto. Confirme a conexão com o Vercel Blob privado e tente novamente.',503);
 }
}
