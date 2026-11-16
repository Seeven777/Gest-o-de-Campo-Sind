/** Agrupamento de roteiros por município e bairro informados no cadastro. */
const normalize=(value:string|null|undefined)=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export type NeighborhoodLocation={city:string|null;district:string|null};
export function neighborhoodKey(value:NeighborhoodLocation):string|null{
 const city=normalize(value.city),district=normalize(value.district);
 return city&&district?city+'|'+district:null;
}
export function assessNeighborhoodSelection(items:NeighborhoodLocation[]){
 if(!items.length)return {valid:false,reason:'Selecione pelo menos uma empresa.'};
 const areas=items.map(neighborhoodKey);
 if(areas.some(x=>x===null))return {valid:false,reason:'Há empresas sem município ou bairro cadastrado. Corrija os endereços antes de criar o roteiro por bairro.'};
 if(new Set(areas).size>1)return {valid:false,reason:'Selecione empresas do mesmo município e bairro. Crie roteiros separados para os demais bairros.'};
 return {valid:true,reason:''};
}

/** Protege o bairro original das rotas homogêneas; rotas legadas mistas
 * continuam editáveis sem forçar uma migração retroativa dos registros. */
export function assessNeighborhoodEdit(original:NeighborhoodLocation[],updated:NeighborhoodLocation[]){
 if(!assessNeighborhoodSelection(original).valid)return {valid:true,reason:''};
 const selection=assessNeighborhoodSelection(updated);
 if(!selection.valid)return selection;
 if(neighborhoodKey(original[0])!==neighborhoodKey(updated[0]))
  return {valid:false,reason:'Este roteiro pertence ao bairro original. Crie outro roteiro para atender uma região diferente.'};
 return {valid:true,reason:''};
}
