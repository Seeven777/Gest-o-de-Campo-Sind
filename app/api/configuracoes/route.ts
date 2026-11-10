import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){const u=await currentIdentity();if(!u)return NextResponse.json({error:'Entre em sua conta.'},{status:401});
 if(u.role!=='admin')return NextResponse.json({profile:{name:u.name,email:u.email,role:u.role},administrator:false});
 const [row]=await db().query('select count(*)::int as companies from establishments');
 return NextResponse.json({profile:{name:u.name,email:u.email,role:u.role},administrator:true,company_count:row.companies,registration_method:'manual',auth_provider:'Neon Auth'});
}
