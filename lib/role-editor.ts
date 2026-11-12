/** Regras de interface; o servidor permanece a fonte de autorização para alterar perfis. */
export type RoleAvailability='ready'|'loading'|'unavailable';
export type Readiness={cadastro:boolean;rh:boolean}|null;
export function getRoleReadinessStatus(role:string,readiness:Readiness,failed=false):RoleAvailability{
 if(role!=='cadastro'&&role!=='rh')return 'ready';
 if(failed)return 'unavailable';
 if(!readiness)return 'loading';
 return readiness[role]?'ready':'unavailable';
}
