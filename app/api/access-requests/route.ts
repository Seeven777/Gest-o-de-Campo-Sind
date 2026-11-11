import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { currentIdentity } from '@/lib/access';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isRole = (role: string): role is 'admin'|'supervisor'|'agent'|'cadastro' => ['admin','supervisor','agent','cadastro'].includes(role);
const genericError = () => NextResponse.json({error:'Não foi possível concluir a solicitação.'}, {status:500});

async function authenticated() {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id || !user.email) return null;
  return { id: String(user.id), email: String(user.email).trim().toLowerCase(), name: String(user.name || '') };
}

// GET: administradores veem a fila; demais usuários veem somente sua solicitação.
export async function GET() {
  try {
    const user = await authenticated();
    if (!user) return NextResponse.json({error:'Entre em sua conta.'}, {status:401});
    const identity = await currentIdentity();
    if (identity?.role === 'admin') {
      const [requests, profiles] = await Promise.all([
        db().query(`SELECT id,auth_user_id,email,full_name,status,assigned_role,created_at,reviewed_at
          FROM access_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 250`),
        db().query(`SELECT p.auth_user_id,p.full_name,p.role,p.is_active,p.created_at,u.email
          FROM app_profiles p LEFT JOIN neon_auth."user" u ON u.id::text=p.auth_user_id
          ORDER BY p.created_at DESC LIMIT 250`),
      ]);
      return NextResponse.json({authorized:true,requests,profiles},{headers:{'Cache-Control':'no-store'}});
    }
    const [request] = await db().query(`SELECT status,created_at,reviewed_at FROM access_requests WHERE auth_user_id=$1`,[user.id]);
    return NextResponse.json({request:request||null,authorized:Boolean(identity)}, {headers:{'Cache-Control':'no-store'}});
  } catch (e) { console.error('[access-requests GET]',e instanceof Error?e.message:e);return genericError(); }
}

// POST: a identidade do pedido vem exclusivamente da sessão autenticada.
export async function POST(request:Request) {
  try {
    const user = await authenticated();
    if (!user) return NextResponse.json({error:'Entre na conta recém-criada para concluir a solicitação.'},{status:401});
    const [existing] = await db().query(`SELECT is_active FROM app_profiles WHERE auth_user_id=$1`,[user.id]);
    if (existing?.is_active) return NextResponse.json({status:'approved',authorized:true});
    const body = await request.json().catch(()=>({}));
    const name = String(body.full_name || user.name).trim().replace(/\s+/g,' ').slice(0,120);
    if (name.length<3) return NextResponse.json({error:'Informe seu nome completo.'},{status:400});
    const [row] = await db().query(`INSERT INTO access_requests(auth_user_id,email,full_name)
      VALUES($1,$2,$3)
      ON CONFLICT(auth_user_id) DO UPDATE SET
        full_name=CASE WHEN access_requests.status='pending' THEN EXCLUDED.full_name ELSE access_requests.full_name END
      RETURNING status`,[user.id,user.email,name]);
    return NextResponse.json({status:row.status},{headers:{'Cache-Control':'no-store'}});
  } catch (e) { console.error('[access-requests POST]',e instanceof Error?e.message:e);return genericError(); }
}

// PATCH: somente administradores podem aprovar ou recusar; nunca aceitar role enviada pelo cadastro público.
export async function PATCH(request:Request) {
  try {
    const operator = await currentIdentity();
    if (!operator) return NextResponse.json({error:'Acesso não autorizado.'},{status:401});
    if (operator.role !== 'admin') return NextResponse.json({error:'Somente administradores podem avaliar cadastros.'},{status:403});
    const body = await request.json().catch(()=>({}));
    const action = String(body.action||'');
    // Administrador pode remanejar colaboradores já ativos entre funções de trabalho,
    // mas nunca modificar outro administrador, conceder admin ou alterar a própria conta.
    if(action==='change-role'){
      const profileId=String(body.profile_id||'');
      const nextRole=String(body.role||'');
      if(!profileId||!['agent','supervisor','cadastro'].includes(nextRole))
        return NextResponse.json({error:'Cargo inválido.'},{status:400});
      const rows=await db().query(`with changed as (
        update app_profiles set role=$2
        where auth_user_id=$1 and auth_user_id<>$3 and is_active=true
          and role in ('agent','supervisor','cadastro') and role<>$2
        returning auth_user_id,role
      ), audited as (
        insert into audit_logs(actor_id,action,details)
        select $3,'access.profile_role_changed',
          jsonb_build_object('profile_id',changed.auth_user_id,'new_role',changed.role)
        from changed returning id
      ) select changed.auth_user_id from changed join audited on true`,[profileId,nextRole,operator.id]);
      if(!rows.length)return NextResponse.json({error:'Perfil não elegível, inativo ou já utiliza o cargo informado.'},{status:409});
      return NextResponse.json({ok:true});
    }
    const id = String(body.id||'');
    const role = String(body.role||'agent');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['approve','reject'].includes(action) || (action==='approve'&&!isRole(role)))
      return NextResponse.json({error:'Solicitação inválida.'},{status:400});

    if (action==='reject') {
      const rows=await db().query(`UPDATE access_requests SET status='rejected', reviewed_by=$2, reviewed_at=now()
        WHERE id=$1 AND status='pending' RETURNING id`,[id,operator.id]);
      if (!rows.length) return NextResponse.json({error:'Solicitação já analisada ou inexistente.'},{status:409});
    } else {
      // Um comando SQL atômico aprova o pedido e ativa o perfil com função decidida pelo administrador.
      const rows=await db().query(`WITH decision AS (
          UPDATE access_requests SET status='approved',assigned_role=$3,reviewed_by=$2,reviewed_at=now()
          WHERE id=$1 AND status='pending' AND auth_user_id<>$2
            AND EXISTS (SELECT 1 FROM neon_auth."user" u WHERE u.id::text=access_requests.auth_user_id AND u."emailVerified"=true AND lower(u.email)=access_requests.email)
          RETURNING auth_user_id,full_name
        ), enabled AS (
          INSERT INTO app_profiles(auth_user_id,full_name,role,is_active)
          SELECT auth_user_id,full_name,$3,true FROM decision
          ON CONFLICT(auth_user_id) DO UPDATE SET full_name=EXCLUDED.full_name,role=EXCLUDED.role,is_active=true
          RETURNING auth_user_id
        ) SELECT auth_user_id FROM enabled`,[id,operator.id,role]);
      if (!rows.length) return NextResponse.json({error:'Não foi possível aprovar. Confirme se a conta possui e-mail verificado e se o pedido está pendente.'},{status:409});
    }
    await db().query(`INSERT INTO audit_logs(actor_id,action,details) VALUES($1,$2,$3::jsonb)`,
      [operator.id,action==='approve'?'access.request_approved':'access.request_rejected',JSON.stringify({request_id:id,...(action==='approve'?{role}:{})})]);
    return NextResponse.json({ok:true});
  } catch (e) { console.error('[access-requests PATCH]',e instanceof Error?e.message:e);return genericError(); }
}
