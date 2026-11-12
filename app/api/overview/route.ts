import {db} from '@/lib/db';
import {withRole} from '@/lib/api';
import {isSchemaReady} from '@/lib/schema-readiness';
export const dynamic='force-dynamic';

/** Os indicadores de captação não dependem da migração do cadastro sindical. */
export async function GET(){
 return withRole(['admin','supervisor'],async()=>{
  const registrationReady=await isSchemaReady('cadastro');
  const registrations=registrationReady
   ?"(select count(*)::int from establishments e join registration_records rr on rr.establishment_id=e.id where e.field_status='validated' and rr.state='confirmed' and rr.official_verified_at is not null)"
   :"null::integer";
  const [totals]=await db().query(`select
   (select count(*)::int from establishments) as establishments,
   (select count(*)::int from routes) as routes,
   (select count(*)::int from visits where checkout_at is not null) as visits,
   (select count(*)::int from establishments where field_status='validated') as validated,
   ${registrations} as registrations,
   (select coalesce(sum(amount),0)::numeric from expenses where approval_status in ('approved','paid')) as approved_expenses`);
  return {totals,registration_ready:registrationReady};
 });
}
