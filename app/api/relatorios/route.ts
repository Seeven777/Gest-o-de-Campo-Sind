import {NextResponse} from 'next/server';import {currentIdentity} from '@/lib/access';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(req:Request){const u=await currentIdentity();if(!u)return NextResponse.json({error:'Sem acesso'},{status:401});
 if(['cadastro','rh'].includes(u.role))return NextResponse.json({error:'Relatórios de campo não autorizados para Cadastro.'},{status:403});
 const url=new URL(req.url);const csv=url.searchParams.get('format')==='csv';
 const admin=u.role!=='agent';
 const rows=await db().query(`select c.name campaign,c.start_date,c.end_date,count(distinct r.id)::int routes,
 count(distinct s.id)::int planned_visits,count(distinct v.id)::int completed_visits,
 coalesce((select sum(x.amount) from expenses x where x.campaign_id=c.id
   and x.approval_status in ('approved','paid') ${admin?'':'and x.agent_id=$1'}),0) costs
 from campaigns c left join routes r on r.campaign_id=c.id ${admin?'':'and r.agent_id=$1'}
 left join route_stops s on s.route_id=r.id left join visits v on v.stop_id=s.id and v.checkout_at is not null
 ${admin?'':'where exists (select 1 from routes assigned where assigned.campaign_id=c.id and assigned.agent_id=$1)'}
 group by c.id order by c.start_date desc limit 100`,admin?[]:[u.id]);
 if(!csv)return NextResponse.json({items:rows});
 const quote=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const headers=['Campanha','Início','Fim','Rotas','Visitas planejadas','Visitas realizadas','Despesas aprovadas'];
 const text=[headers,...rows.map(r=>[r.campaign,r.start_date,r.end_date,r.routes,r.planned_visits,r.completed_visits,r.cost])].map(a=>a.map(quote).join(';')).join('\r\n');
 return new NextResponse('\uFEFF'+text,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="relatorio-campanhas.csv"','Cache-Control':'no-store'}});
}
