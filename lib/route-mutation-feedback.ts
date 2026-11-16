/** Uma falha na atualização visual nunca desfaz nem transforma em erro a mutação já confirmada. */
export async function refreshAfterSuccessfulMutation(reload:()=>Promise<void>):Promise<boolean>{
 try{await reload();return true}
 catch{return false}
}
