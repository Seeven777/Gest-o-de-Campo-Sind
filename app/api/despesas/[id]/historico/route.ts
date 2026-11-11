import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const denied=(error:string,status=403)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentIdentity();
 if(!user)return denied('Entre em sua conta.',401);
 if(!['admin','rh','agent'].includes(user.role))return denied('Histórico reservado ao RH e ao titular.');
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return denied('Identificador inválido.',400);
 const [expense]=await db().query('select id,agent_id from expenses where id=$1',[id]);
 if(!expense||user.role==='agent'&&expense.agent_id!==user.id)return denied('Histórico indisponível.',404);
 const rows=await db().query(`select event.id,event.action,event.before_status,event.after_status,
  event.note,event.details,event.created_at,coalesce(p.full_name,'Registro do sistema') actor_name
  from expense_events event left join app_profiles p on p.auth_user_id=event.actor_id
  where event.expense_id=$1 order by event.id asc limit 500`,[id]);
 return NextResponse.json({items:rows},{headers:{'Cache-Control':'no-store'}});
}
