/** Normaliza a pesquisa por CNPJ, inclusive o formato alfanumérico. 
 * O termo original continua sendo usado para pesquisa por nome e município.
 */
export function normalizeCnpjSearch(value:string):string{
 return value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'');
}
