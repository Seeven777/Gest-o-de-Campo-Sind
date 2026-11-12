import { db } from '@/lib/db';
import { withRole } from '@/lib/api';
const digits=(s:string)=>s.replace(/\D/g,'');
function validCnpj(s:string){const n=digits(s);if(n.length!==14||/^(\d)\1+$/.test(n))return false;for(let l=12;l<=13;l++){let sum=0,w=l===12?5:6;for(let i=0;i<l;i++){sum+=Number(n[i])*w;w=w===2?9:w-1}const dv=sum%11<2?0:11-sum%11;if(Number(n[l])!==dv)return false}return true}
type Incoming={cnpj:string;legal_name:string;trade_name?:string;street?:string;number?:string;district?:string;city?:string;state?:string;postal_code?:string;main_cnae?:string};
const clean=(s:unknown,max:number)=>String(s??'').trim().slice(0,max);
export async function POST(req:Request){return withRole(['admin','supervisor'],async(user)=>{
 const payload=await req.json();const items=payload?.items as Incoming[];
 if(!Array.isArray(items)||items.length<1||items.length>100)return {error:'O lote deve conter de 1 a 100 empresas.'};
 const seen=new Set<string>();let count=0,invalid=0;
 for(const item of items){if(!item||typeof item!=='object'){invalid++;continue}const cnpj=digits(clean(item.cnpj,32));if(!validCnpj(cnpj)||!clean(item.legal_name,255)||seen.has(cnpj)){invalid++;continue}seen.add(cnpj);
   await db().query(`insert into establishments (cnpj,legal_name,trade_name,street,street_number,district,city,state,postal_code,main_cnae,source)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'import_csv') on conflict (cnpj) do update set
      legal_name=excluded.legal_name,
      trade_name=coalesce(nullif(excluded.trade_name,''),establishments.trade_name),
      street=coalesce(nullif(excluded.street,''),establishments.street),
      street_number=coalesce(nullif(excluded.street_number,''),establishments.street_number),
      district=coalesce(nullif(excluded.district,''),establishments.district),
      city=coalesce(nullif(excluded.city,''),establishments.city),
      state=coalesce(nullif(excluded.state,''),establishments.state),
      postal_code=coalesce(nullif(excluded.postal_code,''),establishments.postal_code),
      main_cnae=coalesce(nullif(excluded.main_cnae,''),establishments.main_cnae),
      updated_at=now()`,
      [cnpj,clean(item.legal_name,255),clean(item.trade_name,255),clean(item.street,255),clean(item.number,30),clean(item.district,120),clean(item.city,120),clean(item.state,2).toUpperCase(),digits(clean(item.postal_code,20)),digits(clean(item.main_cnae,20))]);count++;
 }
 await db().query('insert into audit_logs (actor_id,action,details) values($1,$2,$3::jsonb)',[user.id,'companies.import',JSON.stringify({count,invalid})]);
 return {count,invalid};
})}
