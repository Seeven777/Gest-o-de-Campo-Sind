import type {Location} from '@/lib/route-proximity';
import {neighborhoodKey} from '@/lib/route-neighborhood';

export type CandidateScope={cities:string[];sameArea:boolean;city:string;district:string};

/** Usa os mesmos termos para a comparação sem acento do banco de dados.
 * Restringe ao bairro apenas quando TODAS as paradas atuais pertencem a ele.
 * Roteiros legados com bairros mistos continuam recebendo sugestões mais amplas. */
export function normalizeTerritory(value:string|null|undefined):string{
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
}
export function getCandidateScope(selected:Location[]):CandidateScope{
 const cities=[...new Set(selected.map(s=>normalizeTerritory(s.city)).filter(Boolean))];
 const neighborhoods=selected.map(neighborhoodKey);
 const sameArea=selected.length>0&&neighborhoods[0]!==null&&neighborhoods.every(key=>key===neighborhoods[0]);
 return {
  cities,
  sameArea,
  city:sameArea?normalizeTerritory(selected[0].city):'',
  district:sameArea?normalizeTerritory(selected[0].district):''
 };
}
