import { withRole } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(){return withRole(['admin','supervisor','agent'],async(user)=>({user}))}
