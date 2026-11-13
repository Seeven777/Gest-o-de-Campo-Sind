import type {Location} from './route-proximity';

/** Regra única para a análise feita pela API e a publicação da rota. */
export type TerritoryAssessment={
 risk:string;coverage:number;warnings:string[];
 cities:{city:string;count:number}[];
};
export function requiresTerritoryConfirmation(assessment:TerritoryAssessment,stopCount:number):boolean{
 return assessment.risk==='high'||assessment.risk==='attention'||
  assessment.cities.length>1||(stopCount>1&&assessment.coverage<100)||
  stopCount>20;
}
export function validPublicationConfirmation(value:unknown,token:unknown,currentToken:string):boolean{
 return value===true&&typeof token==='string'&&/^[a-f0-9]{32}$/.test(token)&&token===currentToken;
}
