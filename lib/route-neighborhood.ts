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
