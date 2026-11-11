import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { currentIdentity } from '@/lib/access';
import { db } from '@/lib/db';
import {isSchemaReady,schemaPendingMessage} from '@/lib/schema-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
async function admin() {
  const user = await currentIdentity();
  if (!user) return { error: NextResponse.json({ error: 'Entre com seu usuário autorizado.' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Apenas administradores podem gerenciar acessos.' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  try {
    const access = await admin();
    if (access.error) return access.error;
    const [profiles, invitations] = await Promise.all([
      db().query(`select auth_user_id,full_name,role,is_active,created_at from app_profiles order by created_at desc limit 250`),
      db().query(`select id,email,full_name,role,created_at,expires_at,accepted_at,revoked_at from access_invitations order by created_at desc limit 150`),
    ]);
    return NextResponse.json({ profiles, invitations }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[access-invitations] list error', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Não foi possível consultar os acessos. Aplique neon/002_access_invitations.sql.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await admin();
    if (access.error || !access.user) return access.error!;
    const data = await request.json();
    const email = String(data.email || '').trim().toLowerCase();
    const fullName = String(data.full_name || '').trim().replace(/\s+/g,' ');
    const role = String(data.role || '');
    if (!validEmail(email) || fullName.length < 3 || fullName.length > 120 || !['admin','supervisor','agent','cadastro','rh'].includes(role)) {
      return NextResponse.json({ error: 'Informe nome, e-mail e perfil válidos.' }, { status: 400 });
    }
    if((role==='cadastro'||role==='rh')&&!(await isSchemaReady(role==='rh'?'rh':'cadastro')))
      return NextResponse.json({error:schemaPendingMessage(role==='rh'?'rh':'cadastro')},{status:503});
    const existing = await db().query(`select 1 from neon_auth."user" u join app_profiles p on p.auth_user_id = u.id::text where lower(u.email)=$1 and p.is_active=true limit 1`, [email]);
    if (existing.length) return NextResponse.json({ error: 'Este e-mail já possui acesso ativo. Não é necessário criar outro convite.' }, { status: 409 });
    const pending = await db().query(`select 1 from access_invitations where lower(email)=$1 and accepted_at is null and revoked_at is null and expires_at>now() limit 1`, [email]);
    if (pending.length) return NextResponse.json({ error: 'Há um convite válido para esse e-mail. Revogue-o antes de gerar outro.' }, { status: 409 });
    const token = randomBytes(32).toString('base64url');
    const rows = await db().query(`insert into access_invitations (email, full_name, role, token_hash, expires_at, created_by)
      values ($1,$2,$3,$4,now()+interval '72 hours',$5) returning id`,
      [email,fullName,role,hash(token),access.user.id]);
    await db().query(`insert into audit_logs(actor_id,action,details) values ($1,'access.invitation_created',$2::jsonb)`,
      [access.user.id,JSON.stringify({invitation_id:rows[0].id,email,role})]);
    // O link só é retornado uma vez. O token não é armazenado em texto simples.
    return NextResponse.json({ id: rows[0].id, invite_url: `${new URL(request.url).origin}/convite?token=${encodeURIComponent(token)}` }, { status: 201, headers: { 'Cache-Control':'no-store' } });
  } catch (e) {
    console.error('[access-invitations] create error',e instanceof Error ? e.message : e);
    return NextResponse.json({ error:'Falha ao criar convite. Confira a migração do Neon.' },{status:500});
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await admin();
    if (access.error || !access.user) return access.error!;
    const payload = await request.json();
    const id = String(payload.id || '');
    if (!/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error:'Convite inválido.' },{status:400});
    const rows = await db().query(`update access_invitations set revoked_at=now() where id=$1 and accepted_at is null and revoked_at is null returning id`,[id]);
    if (!rows.length) return NextResponse.json({error:'Convite não encontrado ou já utilizado.'},{status:409});
    await db().query(`insert into audit_logs(actor_id,action,details) values ($1,'access.invitation_revoked',$2::jsonb)`,[access.user.id,JSON.stringify({invitation_id:id})]);
    return NextResponse.json({ok:true});
  } catch (e) {
    console.error('[access-invitations] revoke error',e instanceof Error?e.message:e);
    return NextResponse.json({error:'Falha ao revogar convite.'},{status:500});
  }
}
