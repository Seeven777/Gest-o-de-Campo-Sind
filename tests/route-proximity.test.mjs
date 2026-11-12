import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRoute,rankCandidates,kmBetween} from '../lib/route-proximity.ts';
const c=(id,city,lat=null,lon=null,cep='')=>({id,legal_name:id,city,lat,lon,postal_code:cep,trade_name:null,district:null});
test('não inventa distâncias quando só existe endereço textual',()=>{
 assert.equal(kmBetween(c('A','SP'),c('B','SP')),null);
 const x=evaluateRoute([c('a','São Paulo',null,null,'01310000'),c('b','São Paulo',null,null,'01310020')]);
 assert.equal(x.risk,'unknown');assert.equal(x.span_km,null);assert.equal(x.coverage,0);
});
test('quilômetros estimados somente em linha reta e coordenadas válidas',()=>{
 const d=kmBetween(c('a','SP',-23.5505,-46.6333),c('b','SP',-23.551,-46.634));
 assert.ok(d>0&&d<.2);
 assert.equal(kmBetween(c('a','SP',100,40),c('b','SP',0,10)),null);
});
test('destaca deslocamento entre municípios e distância elevada',()=>{
 const x=evaluateRoute([c('a','São Paulo',-23.55,-46.63),c('b','Campinas',-22.9,-47.06)]);
 assert.equal(x.risk,'high');assert.equal(x.cities.length,2);
 assert.equal(x.coverage,100);assert.ok(x.max_jump_km>50);
});
test('ordena sugestões de mesmo CEP sem presumir quilômetros',()=>{
 const ranked=rankCandidates([c('a','São Paulo',null,null,'01310000')],
 [c('b','São Paulo',null,null,'01310020'),c('c','Campinas',null,null,'13000000')]);
 assert.deepEqual(ranked.map(x=>x.id),['b']);assert.equal(ranked[0].nearest_km,null);
 assert.equal(ranked[0].similar_postal,true);
});
test('faixas de CEP distintas exigem revisão, sem criar quilômetros artificiais',()=>{
 const x=evaluateRoute([c('a','São Paulo',null,null,'01310000'),c('b','São Paulo',null,null,'05209000')]);
 assert.equal(x.postal_zones,2);assert.equal(x.span_km,null);
 assert.ok(x.warnings.some(w=>w.includes('faixas de CEP')));
});
test('mantém a sequência definida pelo administrador',()=>{
 const x=evaluateRoute([c('b','São Paulo'),c('a','São Paulo')]);
 assert.equal(x.selected,2);assert.deepEqual(x.points,[]);
});
