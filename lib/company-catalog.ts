export type CatalogCompany={cnpj:string;legal_name:string;trade_name:string;city:string;state:string;main_cnae:string;street:string;number:string;district:string;postal_code:string;type:string;already_in_field?:boolean};
const clean=(v:unknown,max=160)=>String(v??'').trim().slice(0,max);
const digits=(v:unknown)=>String(v??'').replace(/\D/g,'');
export function validCnpj(value:unknown){const n=digits(value);if(n.length!==14||/^(\d)\1+$/.test(n))return false;for(let l=12;l<=13;l++){let sum=0,w=l===12?5:6;for(let i=0;i<l;i++){sum+=Number(n[i])*w;w=w===2?9:w-1}if(Number(n[l])!==(sum%11<2?0:11-sum%11))return false}return true}
export function normalizeCompany(v:Record<string,unknown>):CatalogCompany{
 const get=(...keys:string[])=>keys.map(k=>v[k]).find(x=>x!==undefined&&x!==null&&String(x).length>0);
 return {cnpj:digits(get('cnpj','CNPJ')),legal_name:clean(get('legal_name','razao_social','razaoSocial','nome_empresarial'),250),trade_name:clean(get('trade_name','nome_fantasia','nomeFantasia'),250),city:clean(get('city','municipio','cidade'),120),state:clean(get('state','uf'),2).toUpperCase(),main_cnae:digits(get('main_cnae','cnae','cnae_principal')),street:clean(get('street','logradouro','endereco'),250),number:clean(get('number','numero'),30),district:clean(get('district','bairro'),120),postal_code:digits(get('postal_code','cep')),type:clean(get('type','porte','tipo_empresa'),60)}
}
export async function searchCatalog(filters:URLSearchParams){
 const endpoint=process.env.COMPANY_CATALOG_ENDPOINT;
 if(!endpoint) return {configured:false,items:[] as CatalogCompany[],total:null as number|null};
 const url=new URL(endpoint);
 if(url.protocol!=='https:')throw new Error('A fonte externa precisa utilizar HTTPS.');
 const allowed=['cnae','city','state','type','q','page','limit'];
 for(const key of allowed){const value=filters.get(key);if(value)url.searchParams.set(key,value.slice(0,120))}
 url.searchParams.set('limit','50');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const headers:Record<string,string>={Accept:'application/json'};
  if(process.env.COMPANY_CATALOG_API_KEY) headers.Authorization='Bearer '+process.env.COMPANY_CATALOG_API_KEY;
  const result=await fetch(url,{headers,signal:controller.signal,cache:'no-store',redirect:'error'});
  if(!result.ok)throw new Error('A fonte empresarial retornou HTTP '+result.status);
  const payload=await result.json() as unknown;
  const object=(payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:{}) as Record<string,unknown>;
  const candidate=Array.isArray(payload)?payload:object.items??object.companies??object.data??object.results;
  if(!Array.isArray(candidate))throw new Error('Formato de resposta incompatível. Esperado items[] ou companies[].');
  const items=candidate.slice(0,50).filter((x):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)).map(normalizeCompany).filter(x=>validCnpj(x.cnpj)&&x.legal_name);
  return {configured:true,items,total:typeof object.total==='number'?object.total:null};
 } finally{clearTimeout(timeout)}
}
