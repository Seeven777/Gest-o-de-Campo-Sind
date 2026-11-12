import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {db} from '@/lib/db';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasons:Record<string,string>={
 meal:'Alimentação',restroom:'Necessidade pessoal',fuel:'Abastecimento',other:'Outra necessidade'
};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const originOk=(req:Request)=>{
 const origin=req.headers.get('origin');
 return !origin||new URL(origin).origin===new URL(req.url).origin;
};
const validPoint=(b:Record<string,unknown>)=>{
 const lat=b.lat,lon=b.lon,accuracy=b.accuracy;
 if(typeof lat!=='number'||typeof lon!=='number'||typeof accuracy!=='number')return null;
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||
  !Number.isFinite(accuracy)||accuracy<0||accuracy>10000)return null;
 const ts=Number(b.gps_timestamp);
 if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>120000)return null;
 return {lat,lon,accuracy};
};

/** Registro operacional: não é pedido de autorização nem solicitação financeira. */
export async function GET(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre na sua conta.',401);
 if(!['agent','supervisor','admin'].includes(user.role))return fail('Acesso restrito à operação de campo.',403);
 const routeId=new URL(req.url).searchParams.get('route_id')||'';
 if(user.role==='agent'&&!uuid.test(routeId))return fail('Informe sua rota.');
 if(routeId&&!uuid.test(routeId))return fail('Rota inválida.');
 const rows=await db().query(`select a.id::text as id,a.created_at,
   a.details->>'route_id' as route_id,a.details->>'reason' as reason,
   a.details->>'note' as note,a.details->>'expense_hint' as expense_hint,
   a.details->>'gps_accuracy_m' as gps_accuracy_m,
   coalesce(p.full_name,'Agente') as agent_name
 from audit_logs a
 left join app_profiles p on p.auth_user_id=a.actor_id
 where a.action in ('field.break.recorded','field.break.requested')
 and ($1::text is null or a.actor_id=$1)
 and ($2::text is null or a.details->>'route_id'=$2)
 order by a.id desc limit 100`,[user.role==='agent'?user.id:null,routeId||null]);
 return NextResponse.json({items:rows.map(r=>({
  ...r,status:'recorded',reason_label:reasons[String(r.reason)]||'Parada'
 }))},{headers:{'Cache-Control':'no-store'}});
}

/** O agente registra a parada diretamente; nenhuma aprovação da central é exigida. */
export async function POST(req:Request){
 const user=await currentIdentity();
 if(!user)return fail('Entre na sua conta.',401);
 if(user.role!=='agent')return fail('Somente o agente registra suas próprias paradas.',403);
 if(!originOk(req))return fail('Origem não autorizada.',403);
 const body=await req.json().catch(()=>({})) as Record<string,unknown>;
 const routeId=String(body.route_id||''),clientRequestId=String(body.client_request_id||'');
 const reason=String(body.reason||''),note=String(body.note||'').trim();
 const expenseHint=body.expense_hint===true;
 if(!uuid.test(routeId)||!uuid.test(clientRequestId)||!Object.prototype.hasOwnProperty.call(reasons,reason)||
  note.length>500||(reason==='other'&&note.length<5))
  return fail('Selecione o motivo e descreva quando escolher Outra necessidade.');
 const [route]=await db().query(`select id from routes where id=$1 and agent_id=$2
  and status in ('published','in_progress')`,[routeId,user.id]);
 if(!route)return fail('A rota não está ativa ou não pertence a você.',403);
 // Tentativas repetidas após falha de conexão devolvem o registro confirmado.
 const [existing]=await db().query(`select id::text as id,created_at from audit_logs
   where actor_id=$1 and action='field.break.recorded' and details->>'client_request_id'=$2
   order by id desc limit 1`,[user.id,clientRequestId]);
 if(existing)return NextResponse.json({ok:true,id:existing.id,status:'recorded',
  created_at:existing.created_at,already_registered:true},{headers:{'Cache-Control':'no-store'}});
 const position=validPoint(body);
 const [recorded]=await db().query(`insert into audit_logs(actor_id,action,details)
 values($1,'field.break.recorded',jsonb_build_object(
 'route_id',$2::text,'reason',$3::text,'note',$4::text,'client_request_id',$5::text,
 'expense_hint',$6::boolean,'gps_lat',$7::numeric,'gps_lon',$8::numeric,
 'gps_accuracy_m',$9::numeric))
 returning id::text as id,created_at`,
 [user.id,routeId,reason,note,clientRequestId,expenseHint,
  position?.lat??null,position?.lon??null,position?.accuracy??null]);
 return NextResponse.json({ok:true,id:recorded.id,status:'recorded',created_at:recorded.created_at,
  message:'Parada registrada. Sua rota permanece ativa; não é necessária aprovação.'},
  {status:201,headers:{'Cache-Control':'no-store'}});
}
