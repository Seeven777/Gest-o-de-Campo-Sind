import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readRouteEditResponse} from '../lib/route-edit-response.ts';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('a data da rota sai do PostgreSQL como texto ISO, não JS Date',()=>{
 const api=source('app/api/rotas/[id]/route.ts');
 assert.match(api,/select r\.id,r\.route_date::text as route_date,r\.status/);
 assert.match(api,/r\.route_date::text as route_date/);
 assert.match(api,/console\.error\('\[route-stops-edit\]'/);
});
test('não expõe erro de JSON quando o servidor devolve resposta vazia',async()=>{
 await assert.rejects(readRouteEditResponse(new Response('',{status:500})),/HTTP 500/);
});
test('tratamento de HTML retornado pela plataforma informa o HTTP',async()=>{
 await assert.rejects(readRouteEditResponse(new Response('<html>error</html>',{status:502})),/HTTP 502/);
});
test('resposta estruturada de conflito mantém erro específico',async()=>{
 await assert.rejects(readRouteEditResponse(new Response(JSON.stringify({error:'Rota alterada por outro supervisor.'}),{status:409})),/Rota alterada por outro supervisor/);
});
test('só confirma edição com ok true',async()=>{
 await assert.rejects(readRouteEditResponse(new Response('',{status:200})),/não confirmou/);
 assert.deepEqual(await readRouteEditResponse(new Response(JSON.stringify({ok:true,count:3}),{status:200})),{ok:true,count:3});
});
test('editor usa tratamento resiliente, não response.json diretamente no PUT',()=>{
 const ui=source('components/route-company-editor.tsx');
 assert.match(ui,/await readRouteEditResponse\(response\)/);
 assert.doesNotMatch(ui,/const data=await response\.json\(\);\s*if\(!response\.ok\)/);
});
