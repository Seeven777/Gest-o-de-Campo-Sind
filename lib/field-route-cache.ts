/** Versiona o trajeto no tablet sem persistir endereços em texto no cache. */
export type FieldStopSignature={
 id:string;position_order:number;
 street?:string|null;street_number?:string|null;city?:string|null;state?:string|null;
 lat?:number|null;lon?:number|null;
};
export function fieldRouteFingerprint(date:string,stops:FieldStopSignature[]):string{
 // O token inclui a ordem administrativa e as coordenadas/endereço atuais.
 // Um hash não criptográfico é suficiente: protege apenas a validade do cache.
 const source=JSON.stringify([date,stops.map(s=>[
  s.id,s.position_order,s.street||'',s.street_number||'',s.city||'',s.state||'',s.lat??null,s.lon??null
 ])]);
 let hash=2166136261;
 for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return 'field-v2:'+stops.length+':'+(hash>>>0).toString(36);
}
export function canReuseFieldPlanCache(
 cached:{expires?:number;fingerprint?:string;plan?:{order?:string[]}}|null,
 date:string,stops:FieldStopSignature[],now:number
):boolean{
 if(!cached||!Number.isFinite(cached.expires)||(cached.expires??0)<=now)return false;
 if(cached.fingerprint!==fieldRouteFingerprint(date,stops))return false;
 const order=cached.plan?.order;
 const expected=new Set(stops.map(s=>s.id));
 return Array.isArray(order)&&order.length>0&&order.length<=expected.size&&new Set(order).size===order.length&&order.every(id=>expected.has(id));
}
