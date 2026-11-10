import {get} from '@vercel/blob';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
const denied=()=>new Response('Foto indisponível.',{status:404,headers:{'Cache-Control':'no-store'}});
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const u=await currentIdentity();if(!u)return denied();
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return denied();
 const [row]=await db().query(`select ev.storage_key,ev.mime_type,v.agent_id
 from visit_evidence ev join visits v on v.id=ev.visit_id
 where ev.id=$1 and ev.deleted_at is null and ev.expires_at>now()`,[id]);
 if(!row||!(u.role==='admin'||u.role==='supervisor'||(u.role==='agent'&&row.agent_id===u.id)))return denied();
 try{
  const photo=await get(String(row.storage_key),{access:'private'});
  if(!photo||photo.statusCode!==200||!photo.stream)return denied();
  return new Response(photo.stream,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }catch{return denied()}
}
