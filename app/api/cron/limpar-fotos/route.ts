import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {purgeVisitEvidence} from '@/lib/field-evidence';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return NextResponse.json({error:'Acesso negado'},{status:401});
 const rows=await db().query(`select distinct ev.visit_id from visit_evidence ev join visits v on v.id=ev.visit_id
 where ev.deleted_at is null and (ev.expires_at<=now() or v.review_status in ('approved','rejected')) limit 30`);
 let removed=0,failed=0;
 for(const row of rows){const x=await purgeVisitEvidence(String(row.visit_id));removed+=x.removed;failed+=x.failed}
 return NextResponse.json({removed,failed,visits:rows.length},{headers:{'Cache-Control':'no-store'}});
}
