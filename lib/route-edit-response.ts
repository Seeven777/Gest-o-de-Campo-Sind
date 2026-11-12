/** Contrato consistente do salvamento de paradas, inclusive para respostas sem JSON. */
export type RouteEditResult={ok?:boolean;count?:number;error?:string};
export async function readRouteEditResponse(response:Pick<Response,'text'|'ok'|'status'>):Promise<RouteEditResult>{
 const raw=await response.text();
 let body:RouteEditResult|null=null;
 if(raw.trim())try{
  const parsed:unknown=JSON.parse(raw);
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))body=parsed as RouteEditResult;
 }catch{}
 if(!response.ok)throw Error(body?.error||`Falha na comunicação com a central (HTTP ${response.status}). Atualize a rota e confira se as alterações foram registradas antes de tentar novamente.`);
 if(body?.ok!==true)throw Error('O servidor não confirmou o salvamento da rota. Atualize a página e confira as paradas antes de tentar novamente.');
 return body;
}
