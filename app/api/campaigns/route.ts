import { db } from '@/lib/db';
import { withRole } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(){return withRole(['admin','supervisor','marketing'],async()=>({items:await db().query('select id,name,start_date,end_date,budget,status from campaigns order by created_at desc limit 100')}))}
export async function POST(req:Request){return withRole(['admin','supervisor'],async(user)=>{
 const p=await req.json();const name=String(p.name||'').trim().slice(0,160),start=String(p.start_date||''),end=String(p.end_date||''),budget=Number(p.budget||0);
 if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||!Number.isFinite(budget)||budget<0||budget>100000000)return {error:'Dados da campanha inválidos'};
 const [row]=await db().query('insert into campaigns (name,start_date,end_date,budget,created_by) values ($1,$2,$3,$4,$5) returning id,name',[name,start,end,budget,user.id]);
 return {item:row};
})}
