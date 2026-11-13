/** Mantém ordem, evita duplicidades e respeita o limite operacional de paradas. */
export function addVisibleStops(existing:string[],visible:string[],maximum=49):string[]{
 const result=[...existing],seen=new Set(existing);
 for(const id of visible){
  if(result.length>=maximum)break;
  if(!id||seen.has(id))continue;
  seen.add(id);result.push(id);
 }
 return result;
}
