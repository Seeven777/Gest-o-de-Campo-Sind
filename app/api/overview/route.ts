import { db } from '@/lib/db';
import { withRole } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(){return withRole(['admin','supervisor'], async()=>{
 const [row] = await db().query(`select
   (select count(*)::int from establishments) as establishments,
   (select count(*)::int from campaigns) as campaigns,
   (select count(*)::int from visits) as visits,
   (select count(*)::int from establishments where field_status='validated') as validated,
   (select count(*)::int from registration_records where state='confirmed') as registrations,
   (select coalesce(sum(amount),0)::numeric from expenses where approval_status='approved') as approved_expenses`);
 return {totals:row};
})}
