import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fieldRouteFingerprint,canReuseFieldPlanCache} from '../lib/field-route-cache.ts';
const stops=[
 {id:'a',position_order:1,street:'Rua Alpha',street_number:'10',city:'São Paulo',state:'SP',lat:-23.55,lon:-46.63},
 {id:'b',position_order:2,street:'Rua Beta',street_number:'20',city:'São Paulo',state:'SP',lat:-23.56,lon:-46.64}
];
const now=1_900_000_000_000;
const cache=(values=stops,order=['a','b'])=>({expires:now+3600000,fingerprint:fieldRouteFingerprint('2026-11-16',values),plan:{order}});
test('trajeto inalterado pode ser retomado sem nova otimização',()=>{
 assert.equal(canReuseFieldPlanCache(cache(),'2026-11-16',stops,now),true);
});
test('mudança de ordem administrativa invalida geometria antiga',()=>{
 const reordered=[{...stops[0],position_order:2},{...stops[1],position_order:1}];
 assert.equal(canReuseFieldPlanCache(cache(),'2026-11-16',reordered,now),false);
});
test('mudança de endereço, coordenadas ou data invalida cache',()=>{
 assert.equal(canReuseFieldPlanCache(cache(),'2026-11-16',[{...stops[0],street_number:'99'},stops[1]],now),false);
 assert.equal(canReuseFieldPlanCache(cache(),'2026-11-16',[stops[0],{...stops[1],lon:-46.99}],now),false);
 assert.equal(canReuseFieldPlanCache(cache(),'2026-11-17',stops,now),false);
});
test('troca de empresas e ordem com IDs desconhecidos não reutilizam cache',()=>{
 assert.equal(canReuseFieldPlanCache(cache(),'2026-11-16',[stops[0],{...stops[1],id:'c'}],now),false);
 assert.equal(canReuseFieldPlanCache(cache(stops,['a','x']),'2026-11-16',stops,now),false);
 assert.equal(canReuseFieldPlanCache(cache(stops,['a','a']),'2026-11-16',stops,now),false);
});
test('rotas parciais podem usar cache válido e completar lista com empresas restantes',()=>{
 assert.equal(canReuseFieldPlanCache(cache(stops,['a']),'2026-11-16',stops,now),true);
});
test('versões antigas, vazias e expiradas não são reutilizadas',()=>{
 assert.equal(canReuseFieldPlanCache({expires:now+3600000,plan:{order:['a','b']}},'2026-11-16',stops,now),false);
 assert.equal(canReuseFieldPlanCache({...cache(),expires:now-1},'2026-11-16',stops,now),false);
 assert.equal(canReuseFieldPlanCache(null,'2026-11-16',stops,now),false);
});
test('jornada utiliza assinatura tanto ao salvar quanto ao recuperar',()=>{
 const src=readFileSync(new URL('../app/campo/[id]/page.tsx',import.meta.url),'utf8');
 assert.match(src,/canReuseFieldPlanCache\(cached,route\.route\.route_date,route\.stops,Date\.now\(\)\)/);
 assert.match(src,/fingerprint:fieldRouteFingerprint\(data\.route\.route_date,data\.stops\)/);
 assert.doesNotMatch(src,/stopIds:data\.stops\.map/);
});
