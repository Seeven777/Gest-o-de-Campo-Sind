import {del} from '@vercel/blob';
import {db} from '@/lib/db';
// Remoção física imediata após a decisão, ou depois do prazo de retenção.
// Marca como removido somente após a confirmação do provedor.
export async function purgeVisitEvidence(visitId:string){
 const rows=await db().query('select id,storage_key from visit_evidence where visit_id=$1 and deleted_at is null',[visitId]);
 let removed=0;const failed:string[]=[];
 for(const row of rows){
  try{
   await del(String(row.storage_key));
   await db().query('update visit_evidence set deleted_at=now() where id=$1 and deleted_at is null',[row.id]);
   removed++;
  }catch(e){console.error('[evidência] falha de limpeza',row.id,e instanceof Error?e.message:'falha');failed.push(String(row.id))}
 }
 return {removed,failed:failed.length};
}
