import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const hash = (token:string) => createHash('sha256').update(token).digest('hex');
const validToken = (token:string) => /^[A-Za-z0-9_-]{40,100}$/.test(token);

// Somente o titular do convite pode ativar sua própria conta.
export async function GET(req:Request){
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!validToken(token)) return NextResponse.json({error:'Convite inválido.'},{status:400});
  try {
    const rows = await db().query(`select email,full_name,role,expires_at from access_invitations
      where token_hash=$1 and revoked_at is null and accepted_at is null and expires_at>now() limit 1`,[hash(token)]);
    if(!rows.length) return NextResponse.json({error:'Convite expirado, utilizado ou revogado.'},{status:410});
    return NextResponse.json({ invitation:rows[0] },{headers:{'Cache-Control':'no-store'}});
  } catch (e) {
    console.error('[access-invitations] verify failed', e instanceof Error?e.message:e);
    return NextResponse.json({error:'Não foi possível validar este convite.'},{status:500});
  }
}

export async function POST(req:Request){
  try {
    const data=await req.json();
    const token=String(data.token||'');
    if(!validToken(token)) return NextResponse.json({error:'Convite inválido.'},{status:400});
    const {data:session}=await auth.getSession();
    const user=session?.user;
    if (!user?.id || !user.email) return NextResponse.json({error:'Faça login com o e-mail convidado antes de ativar seu acesso.'},{status:401});
    const email=user.email.trim().toLowerCase();
    // A operação é atômica. Convites consumidos não podem ser reutilizados.
    const rows=await db().query(`with claimed as (
      update access_invitations set accepted_at=now(),accepted_by=$2
      where token_hash=$1 and lower(email)=$3 and revoked_at is null
        and accepted_at is null and expires_at>now()
      returning id,full_name,role
    ), inserted as (
      insert into app_profiles(auth_user_id,full_name,role,is_active)
      select $2,full_name,role,true from claimed
      on conflict(auth_user_id) do update set full_name=excluded.full_name,role=excluded.role,is_active=true
      returning auth_user_id
    ) select id from claimed where exists (select 1 from inserted)`,[hash(token),user.id,email]);
    if(!rows.length) return NextResponse.json({error:'Convite inválido, já utilizado ou de outro e-mail.'},{status:403});
    await db().query(`insert into audit_logs(actor_id,action,details) values($1,'access.invitation_accepted',$2::jsonb)`,[user.id,JSON.stringify({invitation_id:rows[0].id})]);
    return NextResponse.json({ok:true});
  }catch(e){
    console.error('[access-invitations] accept error', e instanceof Error?e.message:e);
    return NextResponse.json({error:'Não foi possível ativar o acesso.'},{status:500});
  }
}
