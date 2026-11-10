import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){const u=await currentIdentity();if(!u)return fail('Sem acesso',401);if(u.role==='marketing')return fail('Acesso restrito',403);
 const rows=await db().query(`select x.id,x.campaign_id,x.agent_id,x.category,x.amount,x.expense_date,x.receipt_storage_key,x.approval_status,c.name campaign_name,p.full_name agent_name
 from expenses x join campaigns c on c.id=x.campaign_id join app_profiles p on p.auth_user_id=x.agent_id
 where ($1::bool=false or x.agent_id=$2) order by x.created_at desc limit 200`,[u.role==='agent',u.id]);return NextResponse.json({items:rows});}
export async function POST(req:Request){const u=await currentIdentity();if(!u||u.role==='marketing')return fail('Sem acesso',403);
 const d=await req.json().catch(()=>({}));const campaign=String(d.campaign_id||''),category=String(d.category||'');
 const amount=Number(d.amount),date=String(d.expense_date||'');
 if(!/^[0-9a-f-]{36}$/i.test(campaign)||!['fuel','food','toll','parking','lodging','other'].includes(category)||!Number.isFinite(amount)||amount<=0||amount>50000||!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail('Despesa inválida.');
 const [c]=await db().query('select id from campaigns where id=$1',[campaign]);if(!c)return fail('Campanha inexistente');
 const [row]=await db().query(`insert into expenses(campaign_id,agent_id,category,amount,expense_date,approval_status) values($1,$2,$3,$4,$5,'submitted') returning id`,[campaign,u.id,category,amount,date]);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'expense.submitted',JSON.stringify({id:row.id,amount})]);
 return NextResponse.json({item:row});
}
export async function PATCH(req:Request){const u=await currentIdentity();if(!u||!['admin','supervisor'].includes(u.role))return fail('Apenas aprovação administrativa',403);
 const d=await req.json().catch(()=>({}));const id=String(d.id||''),status=String(d.status||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['approved','rejected','returned','paid'].includes(status))return fail('Ação inválida');
 const from=status==='paid'?'approved':'submitted';
 const rows=await db().query('update expenses set approval_status=$2,approved_by=$3 where id=$1 and approval_status=$4 returning id',[id,status,u.id,from]);
 if(!rows.length)return fail('Despesa inexistente ou fora da etapa permitida.',409);
 await db().query('insert into audit_logs(actor_id,action,details) values($1,$2,$3::jsonb)',[u.id,'expense.status',JSON.stringify({id,status})]);
 return NextResponse.json({ok:true});
}
