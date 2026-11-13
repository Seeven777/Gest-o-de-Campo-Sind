import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRoute,kmBetween,rankCandidates} from '../lib/route-proximity.ts';
const company=(id,lat,lon)=>({id,legal_name:id,trade_name:null,city:'São Paulo',district:'Sé',postal_code:'01001000',lat,lon});

test('não contabiliza coordenadas inválidas como empresas localizadas',()=>{
 const companies=[company('válida',-23.55,-46.63),company('latitude inválida',999,-46.62),company('lon inválida',-23.54,-999),company('nula',null,-46.62),company('não finita',NaN,-46.61)];
 const report=evaluateRoute(companies);
 assert.equal(report.selected,5);
 assert.equal(report.located,1);
 assert.equal(report.coverage,20);
 assert.deepEqual(report.points.map(x=>x.id),['válida']);
 assert.equal(report.span_km,null);
 assert.equal(report.risk,'unknown');
 assert.ok(report.warnings.some(x=>x.includes('4 empresa(s) sem coordenadas')));
});

test('rota sem coordenadas válidas não produz pontos ou cobertura fictícia',()=>{
 const report=evaluateRoute([company('fora',91,20),company('ausente',null,null)]);
 assert.equal(report.located,0);
 assert.equal(report.coverage,0);
 assert.deepEqual(report.points,[]);
 assert.equal(report.span_km,null);
 assert.equal(kmBetween(company('fora',91,20),company('ausente',null,null)),null);
});

test('ranking de proximidade não inventa distâncias',()=>{
 const result=rankCandidates([company('origem',999,999)],[company('destino',-23.55,-46.63)]);
 assert.equal(result[0].nearest_km,null);
 assert.equal(result[0].same_city,true);
});