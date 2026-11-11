import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){const u=await currentIdentity();if(!u)return NextResponse.json({error:'Sem acesso'},{status:401});
 if(u.role==='cadastro')return NextResponse.json({error:'Acesso restrito à equipe operacional.'},{status:403});
 const rows=await db().query(`select distinct c.id,c.name from campaigns c left join routes r on r.campaign_id=c.id where ($1::bool=false or (r.agent_id=$2 and r.status in ('published','in_progress','completed'))) and c.status<>'cancelled' order by c.name`,[u.role==='agent',u.id]);
 return NextResponse.json({items:rows});}
