import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasons:Record<string,string>={meal:'Alimentação',restroom:'Necessidade pessoal',fuel:'Abastecimento',other:'Outra necessidade'};
const failure=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const originOk=(req:Request)=>{const origin=req.headers.get('origin');return !origin||new URL(origin).origin===new URL(req.url).origin;};

/** Consulta pelo agente ou pela central. Retorna somente solicitações da própria rota para agentes. */
export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return failure('Acesso não autorizado.',401);
 if(!['agent','supervisor','admin'].includes(user.role))return failure('Acesso restrito à operação de campo.',403);
 const url=new URL(req.url),routeId=url.searchParams.get('route_id')||'';
 if(user.role==='agent'&&!uuid.test(routeId))return failure('Informe a rota para consultar sua solicitação.');
 if(routeId&&!uuid.test(routeId))return failure('Rota inválida.');
 const params:unknown[]=[user.role==='agent'?user.id:null,routeId||null];
 const rows=await db().query(`select a.id::text as id,a.created_at,
   a.details->>'route_id' as route_id,
   a.details->>'reason' as reason,
   a.details->>'note' as note,
   coalesce(p.full_name,'Agente') as agent_name,
   d.details->>'decision' as decision,
   d.details->>'note' as decision_note,
   d.created_at as decided_at
 from audit_logs a
 left join app_profiles p on p.auth_user_id=a.actor_id
 left join lateral (
   select x.details,x.created_at
   from audit_logs x
   where x.action='field.break.decided' and x.details->>'request_id'=a.id::text
   order by x.id desc limit 1
 ) d on true
 where a.action='field.break.requested'
 and ($1::text is null or a.actor_id=$1)
 and ($2::text is null or a.details->>'route_id'=$2)
 order by a.id desc limit 100`,params);
 return NextResponse.json({items:rows.map(r=>({...r,status:r.decision||'pending',reason_label:reasons[String(r.reason)]||'Parada'}))},
  {headers:{'Cache-Control':'no-store'}});
}

/** A equipe solicita, mas não aprova nem interrompe sua rota por conta própria. */
export async function POST(req:Request){
 const user=await currentIdentity();
 if(!user)return failure('Entre na sua conta.',401);
 if(user.role!=='agent')return failure('Solicitações de parada são exclusivas do agente em rota.',403);
 if(!originOk(req))return failure('Origem não autorizada.',403);
 const body=await req.json().catch(()=>({})) as Record<string,unknown>;
 const routeId=String(body.route_id||''),reason=String(body.reason||''),note=String(body.note||'').trim();
 if(!uuid.test(routeId)||!Object.prototype.hasOwnProperty.call(reasons,reason)||note.length>500||(reason==='other'&&note.length<5))
  return failure('Escolha a necessidade da parada e descreva quando selecionar Outra.');
 const [route]=await db().query(`select id from routes where id=$1 and agent_id=$2
  and status in ('published','in_progress')`,[routeId,user.id]);
 if(!route)return failure('Sua rota não está ativa ou não pertence à sua equipe.',403);
 const [previous]=await db().query(`select a.id::text as id from audit_logs a
  where a.actor_id=$1 and a.action='field.break.requested'
   and a.details->>'route_id'=$2 order by a.id desc limit 1`,[user.id,routeId]);
 if(previous){
  const [resolved]=await db().query(`select id from audit_logs
   where action='field.break.decided' and details->>'request_id'=$1 limit 1`,[previous.id]);
  if(!resolved)return failure('Você já tem uma solicitação aguardando resposta da central.',409);
 }
 const [row]=await db().query(`insert into audit_logs(actor_id,action,details)
  values($1,'field.break.requested',jsonb_build_object('route_id',$2::text,'reason',$3::text,'note',$4::text))
  returning id::text as id,created_at`,[user.id,routeId,reason,note]);
 return NextResponse.json({ok:true,id:row.id,status:'pending',created_at:row.created_at,
  message:'Pedido registrado para ajuste operacional do percurso. Intervalos legais não dependem da aprovação deste aplicativo.'},
  {status:201,headers:{'Cache-Control':'no-store'}});
}

/** Decisão reservada à central; cria novo evento sem adulterar o pedido original. */
export async function PATCH(req:Request){
 const user=await currentIdentity();
 if(!user)return failure('Entre na sua conta.',401);
 if(!['supervisor','admin'].includes(user.role))return failure('Somente a central pode autorizar paradas.',403);
 if(!originOk(req))return failure('Origem não autorizada.',403);
 const body=await req.json().catch(()=>({})) as Record<string,unknown>;
 const requestId=String(body.request_id||''),decision=String(body.decision||''),note=String(body.note||'').trim();
 if(!/^\d+$/.test(requestId)||!['approved','denied'].includes(decision)||note.length>500||
  (decision==='denied'&&note.length<8))return failure('Decisão inválida ou sem justificativa suficiente.');
 const [existing]=await db().query(`select id from audit_logs
  where id=$1::bigint and action='field.break.requested'`,[requestId]);
 if(!existing)return failure('Solicitação não localizada.',404);
 const [already]=await db().query(`select id from audit_logs
  where action='field.break.decided' and details->>'request_id'=$1 limit 1`,[requestId]);
 if(already)return failure('Esta solicitação já foi analisada. Atualize a central.',409);
 const [row]=await db().query(`insert into audit_logs(actor_id,action,details)
  values($1,'field.break.decided',jsonb_build_object('request_id',$2::text,'decision',$3::text,'note',$4::text))
  returning id::text as id`,[user.id,requestId,decision,note]);
 return NextResponse.json({ok:true,id:row.id,status:decision},{headers:{'Cache-Control':'no-store'}});
}
