import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRecentNavigationHandoff} from '../lib/field-navigation-handoff.ts';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('handoff para Waze tem janela curta e não aceita relógio invertido',()=>{
 assert.equal(isRecentNavigationHandoff(10000,10000),true);
 assert.equal(isRecentNavigationHandoff(10000,19999),true);
 assert.equal(isRecentNavigationHandoff(10000,20000),true);
 assert.equal(isRecentNavigationHandoff(10000,20001),false);
 assert.equal(isRecentNavigationHandoff(0,0),false);
 assert.equal(isRecentNavigationHandoff(20000,19999),false);
 assert.equal(isRecentNavigationHandoff(NaN,20000),false);
});
test('somente clique no Waze com veículo parado marca o handoff',()=>{
 const panel=source('components/crew-travel-panel.tsx');
 assert.match(panel,/else p\.onWazeOpen\(\)/);
 assert.match(panel,/if\(p.driving\)\{e.preventDefault\(\);p.onBlockedWaze\(\)\}/);
 assert.match(panel,/aria-disabled=\{p.driving\}/);
});
test('GPS não é desligado automaticamente durante handoff recente, mas encerra em saída comum',()=>{
 const field=source('app/campo/[id]/page.tsx');
 assert.match(field,/isRecentNavigationHandoff\(wazeHandoffAt.current,Date.now\(\)\)\)return/);
 assert.match(field,/navigator\.sendBeacon\('\/api\/campo\/localizacao'/);
 assert.match(field,/onWazeOpen=\{\(\)=>\{wazeHandoffAt.current=Date.now\(\)\}\}/);
 assert.match(field,/document\.addEventListener\('visibilitychange',resume\)/);
 assert.match(field,/navigator\.geolocation\.clearWatch\(watch\)/);
});
test('API permanece responsável por exigir consentimento no início e encerrar rota específica',()=>{
 const api=source('app/api/campo/localizacao/route.ts');
 assert.match(api,/if\(d.consent!==true\)/);
 assert.match(api,/where agent_id=\$1 and active=true and route_id=\$2::uuid/);
});

test('observações opcionais ficam somente no fim, mantendo registro enviado',()=>{
 const field=source('app/campo/[id]/page.tsx');
 assert.match(field,/finalQuestion&&<div className="crew-observation-field">/);
 assert.match(field,/maxLength=\{2000\} value=\{notes\}/);
 assert.match(field,/onChange=\{e=>setNotes\(e.target.value\)\}/);
 assert.match(field,/notes,?\b/);
});
