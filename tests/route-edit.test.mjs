import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('edicao de rotas so para central e antes da jornada',()=>{
 const s=source('app/api/rotas/[id]/route.ts');
 assert.match(s,/user\.role\)\)return fail\('Edição restrita/);
 assert.match(s,/r\.status in \('draft','published'\)/);
 assert.match(s,/not exists\(select 1 from route_stops es join visits v/);
 assert.match(s,/not exists\(select 1 from agent_live_presence gps/);
});
test('edicao valida token e persiste todos os passos em transacao',()=>{
 const s=source('app/api/rotas/[id]/route.ts');
 assert.match(s,/edit_token/);
 assert.match(s,/sql\.transaction\(\[/);
 assert.match(s,/position_order=position_order\+1000/);
 assert.match(s,/on conflict\(route_id,establishment_id\) do update/);
 assert.match(s,/route\.stops_edited/);
});
test('proximidade disponivel durante criacao e edicao',()=>{
 assert.match(source('app/rotas/page.tsx'),/<RouteProximityPanel/);
 assert.match(source('components/route-company-editor.tsx'),/<RouteProximityPanel/);
 assert.match(source('components/route-company-editor.tsx'),/method:'PUT'/);
});
test('publicação exige confirmação territorial emitida pelo servidor',()=>{
 const s=source('app/rotas/page.tsx');
 assert.match(s,/requires_confirmation/);
 assert.match(s,/window.confirm/);
 assert.match(s,/request\(true,payload.edit_token\)/);
});
test('finalizacao e visitas anteriores bloqueiam alteracao',()=>{
 const s=source('app/api/rotas/[id]/route.ts');
 assert.match(s,/has_visits/);
 assert.match(s,/active_gps/);
 assert.match(s,/não podem mais ser editadas|A edição só é permitida/);
});
