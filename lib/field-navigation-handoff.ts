/** A troca para o Waze não significa que o agente encerrou a jornada.
 * A exceção é curta e só nasce de um clique explícito no link externo. */
export function isRecentNavigationHandoff(
 openedAt:number,now:number,windowMs=10000
):boolean{
 return Number.isFinite(openedAt)&&openedAt>0&&
  Number.isFinite(now)&&now>=openedAt&&now-openedAt<=windowMs;
}
