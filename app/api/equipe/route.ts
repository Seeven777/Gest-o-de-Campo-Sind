import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){const u=await currentIdentity();if(!u||u.role==='agent')return NextResponse.json({error:'Acesso restrito'},{status:403});
 const items=await db().query("select auth_user_id as id,full_name from app_profiles where role='agent' and is_active=true order by full_name");
 return NextResponse.json({items});}
