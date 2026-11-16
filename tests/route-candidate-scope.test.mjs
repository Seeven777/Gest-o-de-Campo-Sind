import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getCandidateScope,normalizeTerritory} from '../lib/route-candidate-scope.ts';
const c=(id,city,district)=>({id,city,district,legal_name:id,lat:null,lon:null});
test('normaliza cidades e bairros sem acento',()=>{
 assert.equal(normalizeTerritory(' SÃO  PAULO '),'sao paulo');
 assert.equal(normalizeTerritory('ÁGUA BRANCA'),'agua branca');
});
test('restringe ao mesmo bairro quando a rota é homogênea',()=>{
 const x=getCandidateScope([c('a','SAO PAULO','ÁGUA BRANCA'),c('b','São Paulo','Agua Branca')]);
 assert.deepEqual(x,{cities:['sao paulo'],sameArea:true,city:'sao paulo',district:'agua branca'});
});
test('não exclui empresas válidas de rotas antigas com múltiplos bairros',()=>{
 const x=getCandidateScope([c('a','Atibaia','Centro'),c('b','Atibaia','Caetetuba')]);
 assert.equal(x.sameArea,false);assert.deepEqual(x.cities,['atibaia']);
});
test('bairro ausente não restringe a seleção e pode buscar outras empresas da cidade',()=>{
 const x=getCandidateScope([c('a','Jundiaí',null),c('b','Jundiai','Centro')]);
 assert.equal(x.sameArea,false);assert.deepEqual(x.cities,['jundiai']);
});
test('backend prioriza bairro e CEP no SQL antes do limite',()=>{
 const api=readFileSync(new URL('../app/api/rotas/planejamento/route.ts',import.meta.url),'utf8');
 assert.match(api,/getCandidateScope\(selected\)/);
 assert.match(api,/e\.district/);
 assert.match(api,/unaccent/);
 assert.match(api,/limit 150/);
 assert.match(api,/rankCandidates\(selected,candidates,12\)/);
 assert.match(api,/sameArea/);
});
