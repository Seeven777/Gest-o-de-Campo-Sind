import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
import {searchCatalog,validCnpj} from '@/lib/company-catalog';
export const dynamic='force-dynamic';export const runtime='nodejs';
const err=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(req:Request){
 const user=await currentIdentity();if(!user||!['admin','supervisor'].includes(user.role))return err('Acesso restrito à administração e supervisão.',403);
 try{
  const {configured,items,total}=await searchCatalog(new URL(req.url).searchParams);
  if(!configured)return NextResponse.json({configured:false,items:[],error:'Configure COMPANY_CATALOG_ENDPOINT na Vercel.'});
  const ids=items.map(x=>x.cnpj);
  const registered=ids.length?await db().query('select cnpj,field_status from establishments where cnpj=ANY($1::text[])',[ids]):[];
  const existing=new Map(registered.map(x=>[String(x.cnpj),String(x.field_status)]));
  return NextResponse.json({configured:true,total,items:items.map(x=>({...x,already_in_field:existing.has(x.cnpj),field_status:existing.get(x.cnpj)||null}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return err(e instanceof Error?e.message:'Erro ao consultar catálogo.',502)}
}
export async function POST(req:Request){
 const user=await currentIdentity();if(!user||!['admin','supervisor'].includes(user.role))return err('Acesso não autorizado.',403);
 const payload=await req.json().catch(()=>({}));const input=payload.cnpjs;
 if(!Array.isArray(input)||!input.length||input.length>50)return err('Selecione entre 1 e 50 CNPJs.');
 const cnpjs=[...new Set(input.map(String))];
 if(cnpjs.length!==input.length||cnpjs.some(c=>!validCnpj(c)))return err('Seleção contém CNPJ inválido ou duplicado.');
 // Fonte externa é consultada novamente no servidor: nunca confiar nos dados enviados pelo navegador.
 const params=new URLSearchParams();
 const filters=payload.filters||{};
 for(const key of ['cnae','city','state','type','q','page']){
  const v=filters[key];if(typeof v==='string'&&v)params.set(key,v.slice(0,120));
 }
 const {configured,items}=await searchCatalog(params);
 if(!configured)return err('Integração externa não configurada.',503);
 const byCnpj=new Map(items.map(c=>[c.cnpj,c]));
 if(cnpjs.some(c=>!byCnpj.has(c)))return err('A seleção não corresponde ao resultado atual do catálogo. Refaça a pesquisa.',409);
 let added=0,existing=0,invalid=0;
 for(const cnpj of cnpjs){
  const c=byCnpj.get(cnpj)!;
  const rows=await db().query(`insert into establishments(cnpj,legal_name,trade_name,street,street_number,district,city,state,postal_code,main_cnae,source)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'catalog_external')
    on conflict(cnpj) do nothing returning id`,
    [c.cnpj,c.legal_name,c.trade_name,c.street,c.number,c.district,c.city,c.state,c.postal_code,c.main_cnae]);
  rows.length?added++:existing++;
 }
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[user.id,'catalog.selection',JSON.stringify({added,existing,invalid})]);
 return NextResponse.json({added,existing,invalid});
}
