import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';export const runtime='nodejs';
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
type Kind='route'|'visit'|'expense'|'campaign'|'company';
const kinds=['route','visit','expense','campaign','company'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function candidates(kind:Kind,term:string){
 if(kind==='route')return db().query(`select r.id,c.name||' · '||r.route_date::text as label,
 (select count(*)::int from route_stops s where s.route_id=r.id) as linked,
 (select count(*)::int from visits v join route_stops s on s.id=v.stop_id where s.route_id=r.id) as visits
 from routes r join campaigns c on c.id=r.campaign_id where c.name ilike '%teste%' and (c.name ilike '%'||$1||'%' or r.id::text=$1) order by r.created_at desc limit 50`,[term]);
 if(kind==='visit')return db().query(`select v.id,e.legal_name||' · '||v.created_at::date::text as label,0::int linked,0::int visits from visits v
 join route_stops s on s.id=v.stop_id join routes r on r.id=s.route_id join campaigns c on c.id=r.campaign_id join establishments e on e.id=s.establishment_id
 where c.name ilike '%teste%' and (e.legal_name ilike '%'||$1||'%' or v.id::text=$1) order by v.created_at desc limit 50`,[term]);
 if(kind==='expense')return db().query(`select e.id,c.name||' · R$ '||e.amount::text as label,0::int linked,0::int visits from expenses e join campaigns c on c.id=e.campaign_id where c.name ilike '%teste%' and e.approval_status<>'paid' and (c.name ilike '%'||$1||'%' or e.id::text=$1) order by e.created_at desc limit 50`,[term]);
 if(kind==='campaign')return db().query(`select c.id,c.name as label,(select count(*)::int from routes where campaign_id=c.id) as linked,
 (select count(*)::int from expenses where campaign_id=c.id) as visits from campaigns c where c.name ilike '%teste%' and (c.name ilike '%'||$1||'%' or c.id::text=$1) order by c.created_at desc limit 50`,[term]);
 return db().query(`select e.id,e.legal_name||' · '||e.cnpj::text as label,
 (select count(*)::int from route_stops s where s.establishment_id=e.id) as linked,
 (select count(*)::int from registration_records rr where rr.establishment_id=e.id and rr.state='confirmed') as visits
 from establishments e where (e.legal_name ilike '%'||$1||'%' or e.cnpj::text like '%'||$1||'%' or e.id::text=$1) order by e.created_at desc limit 50`,[term]);
}
export async function GET(req:Request){
 const u=await currentIdentity();if(!u||u.role!=='admin')return fail('Somente administradores podem acessar a limpeza de testes.',403);
 const url=new URL(req.url);const kind=url.searchParams.get('kind') as Kind;
 if(!kinds.includes(kind))return fail('Tipo inválido.');
 const term=(url.searchParams.get('q')||'').trim().slice(0,100);
 const [capability]=await db().query(`select to_regprocedure('public.admin_delete_test_record(text,uuid,text)') is not null as ready`);
 if(kind==='company'&&term.length<3)return NextResponse.json({
  items:[],note:'Pesquise pelo menos três caracteres para localizar empresas.',deletion_available:Boolean(capability?.ready)
 },{headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({items:await candidates(kind,term),deletion_available:Boolean(capability?.ready)},
  {headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(req:Request){
 const u=await currentIdentity();if(!u||u.role!=='admin')return fail('Somente administradores podem excluir registros.',403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return fail('Origem não autorizada.',403);
 const body=await req.json().catch(()=>({}));const kind=String(body.kind||'') as Kind,id=String(body.id||''),confirmation=String(body.confirmation||'');
 if(!kinds.includes(kind)||!uuid.test(id))return fail('Registro inválido.');
 const current=await candidates(kind,id);const item=current.find(x=>String(x.id)===id);
 if(!item)return fail('Registro não encontrado ou não elegível para a limpeza.',404);
 if(confirmation!==('EXCLUIR '+String(item.label)))return fail('A confirmação não corresponde ao nome do registro.');
 const [capability]=await db().query(`select to_regprocedure('public.admin_delete_test_record(text,uuid,text)') is not null as ready`);
 if(!capability?.ready)return fail('A limpeza ainda não está habilitada no Neon. Após backup, aplique manualmente a migração neon/005_limpeza_segura.sql.',503);
 try{const result=await db().query('select admin_delete_test_record($1,$2::uuid,$3) as deleted',[kind,id,u.id]);
  return NextResponse.json({deleted:Number(result[0]?.deleted||0)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('[limpeza de testes]',e instanceof Error?e.message:e);return fail('Exclusão impedida por vínculos, situação do registro ou migração SQL pendente. Consulte os logs do servidor.',409)}
}
