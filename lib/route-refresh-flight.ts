/** Consolida eventos simultâneos de foco/visibilidade em uma única consulta.
 * Uma nova consulta pode ocorrer logo após o término, inclusive após falha.
 */
export function createRouteRefreshFlight(){
 let pending:Promise<void>|null=null;
 return (task:()=>Promise<void>):Promise<void>=>{
  if(pending)return pending;
  const current=Promise.resolve().then(task);
  pending=current.finally(()=>{pending=null});
  return pending;
 };
}
