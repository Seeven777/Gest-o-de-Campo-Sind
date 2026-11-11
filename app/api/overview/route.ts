import { db } from '@/lib/db';
import { withRole } from '@/lib/api';
import {NextResponse} from 'next/server';
import {isSchemaReady,schemaPendingMessage} from '@/lib/schema-readiness';
export const dynamic='force-dynamic';
export async function GET(){return withRole(['admin','supervisor'], async()=>{
 if(!(await isSchemaReady('cadastro')))return NextResponse.json({error:schemaPendingMessage('cadastro')},{status:503});
 const [row] = await db().query(`select
   (select count(*)::int from establishments) as establishments,
   (select count(*)::int from campaigns) as campaigns,
   (select count(*)::int from visits) as visits,
   (select count(*)::int from establishments where field_status='validated') as validated,
   (select count(*)::int from registration_records where state='confirmed' and official_verified_at is not null) as registrations,
   (select coalesce(sum(amount),0)::numeric from expenses where approval_status='approved') as approved_expenses`);
 return {totals:row};
})}
