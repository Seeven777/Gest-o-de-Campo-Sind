import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db';
export type Role = 'admin' | 'supervisor' | 'agent';
export type Identity = {id:string; name:string; email:string; role:Role};
export async function currentIdentity():Promise<Identity|null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if(!user?.id) return null;
  const rows = await db().query('select full_name, role from app_profiles where auth_user_id = $1 and is_active = true limit 1',[user.id]);
  const profile = rows[0] as {full_name:string;role:Role}|undefined;
  if(!profile) return null;
  return {id:user.id,name:profile.full_name,email:user.email||'',role:profile.role};
}
export function allowed(role:Role, accepted:Role[]){return accepted.includes(role)}
