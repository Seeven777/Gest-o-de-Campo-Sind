import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {neighborhoodKey,assessNeighborhoodSelection} from '../lib/route-neighborhood.ts';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('agrupa nomes de bairros ignorando espaços e acentos',()=>{
 assert.equal(neighborhoodKey({city:'São Paulo',district:'Vila Mariana'}),neighborhoodKey({city:' sao  paulo ',district:' VILA  MARIANA '}));
 assert.notEqual(neighborhoodKey({city:'São Paulo',district:'Centro'}),neighborhoodKey({city:'Campinas',district:'Centro'}));
});
test('novas rotas só aceitam mesmo município e bairro preenchidos',()=>{
 assert.equal(assessNeighborhoodSelection([{city:'São Paulo',district:'Pinheiros'},{city:'Sao Paulo',district:'pinheiros'}]).valid,true);
 assert.equal(assessNeighborhoodSelection([{city:'São Paulo',district:'Pinheiros'},{city:'São Paulo',district:'Butantã'}]).valid,false);
 assert.equal(assessNeighborhoodSelection([{city:'São Paulo',district:'Centro'},{city:'Campinas',district:'Centro'}]).valid,false);
 assert.equal(assessNeighborhoodSelection([{city:'São Paulo',district:null}]).valid,false);
 assert.equal(assessNeighborhoodSelection([]).valid,false);
});
test('API de bairros exige login e gestão; retorna bairros associados à cidade',()=>{
 const api=src('app/api/rotas/bairros/route.ts');
 assert.match(api,/currentIdentity\(\)/);
 assert.match(api,/\['admin','supervisor'\]/);
 assert.match(api,/districts:rows,city/);
 assert.match(api,/unaccent\(trim\(district\)\)/);
});
test('API de empresas filtra bairro exato normalizado sem perder escopo do agente',()=>{
 const api=src('app/api/companies/route.ts');
 assert.match(api,/const districtParam=user.role==='agent'\?'\$8':'\$7'/);
 assert.match(api,/e.city,e.district/);
 assert.match(api,/lower\(unaccent\(trim\(coalesce\(e.district/);
 assert.match(api,/user.id,district/);
});
test('servidor impede criação de nova rota com bairros misturados',()=>{
 const api=src('app/api/rotas/route.ts');
 assert.match(api,/assessNeighborhoodSelection\(check\.map/);
 assert.match(api,/if\(!territory.valid\)return fail\(territory.reason,409\)/);
 const editor=src('app/api/rotas/[id]/route.ts');
 assert.match(editor,/assessNeighborhoodSelection\(originalAreas\.map/);
 assert.match(editor,/assessNeighborhoodSelection\(newAreas\.map/);
});
test('interface separa escolha município bairro e busca restrita',()=>{
 const page=src('app/rotas/page.tsx');
 assert.match(page,/routes-neighborhood-picker/);
 assert.match(page,/city:areaCity,district:areaDistrict/);
 assert.match(page,/neighborhoodKey\(company\)!==neighborhoodKey/);
 assert.match(page,/disabled=\{busy\|\|!selected.length\|\|!agent\|\|!date\|\|!city\|\|!district\}/);
});

test('troca de bairro invalida buscas antigas e lista mostra identificação territorial',()=>{
 const page=src('app/rotas/page.tsx');
 assert.match(page,/companyRequest\.current\+\+/);
 assert.match(page,/request===companyRequest\.current/);
 assert.match(page,/request===districtRequest\.current/);
 assert.match(page,/neighborhood_label/);
 const api=src('app/api/rotas/route.ts');
 assert.match(api,/district_label/);
});

test('editor usa município e bairro da rota e não mistura pesquisa de outras regiões',()=>{
 const editor=src('components/route-company-editor.tsx');
 const route=src('app/rotas/[id]/page.tsx');
 assert.match(editor,/singleArea=assessNeighborhoodSelection\(stops\).valid/);
 assert.match(editor,/page:String\(nextPage\),city,district/);
 assert.match(editor,/city=\{city\|\|undefined\} district=\{district\|\|undefined\}/);
 assert.match(route,/district:string\|null;city:string\|null/);
});
