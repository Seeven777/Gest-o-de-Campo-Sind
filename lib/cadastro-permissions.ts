/** Somente Supervisor, Cadastro e Administração acessam o histórico confirmado. */
export function canReadCadastroHistory(role:string):boolean{
 return role==='admin'||role==='supervisor'||role==='cadastro';
}
/** Apenas Cadastro e Administração podem ver a fila ou registrar uma confirmação. */
export function canConfirmCadastro(role:string):boolean{
 return role==='admin'||role==='cadastro';
}
