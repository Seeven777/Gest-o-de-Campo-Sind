import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){const u=await currentIdentity();if(!u||u.role==='agent')return NextResponse.json({error:'Acesso restrito'},{status:403});
 const rows=await db().query(`select coalesce(nullif(trim(e.city),''),'Não informado') city,
 count(*)::int total,count(*) filter(where e.field_status='validated')::int validated,
 count(*) filter(where e.field_status='pending')::int pending,
 count(*) filter(where rr.state='confirmed')::int registered
 from establishments e left join registration_records rr on rr.establishment_id=e.id
 group by 1 order by total desc limit 300`);
 return NextResponse.json({items:rows});}
