import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('exclusão somente para administração ou supervisão com origem válida',()=>{
 const route=read('app/api/rotas/[id]/route.ts');
 const section=route.slice(route.indexOf('export async function DELETE'),route.indexOf('export async function PUT'));
 assert.match(section,/currentIdentity\(\)/);
 assert.match(section,/\['admin','supervisor'\]/);
 assert.match(section,/Origem não autorizada/);
 assert.match(section,/uuid\.test\(id\)/);
 assert.match(section,/\^\[a-f0-9\]\{32\}\$/);
});
test('exclusão exige rascunho, token e ausência de visitas ou GPS',()=>{
 const route=read('app/api/rotas/[id]/route.ts');
 const section=route.slice(route.indexOf('export async function DELETE'),route.indexOf('export async function PUT'));
 assert.match(section,/r\.status='draft'/);
 assert.match(section,/md5\(coalesce/);
 assert.match(section,/route_stops s join visits v/);
 assert.match(section,/agent_live_presence gps/);
 assert.match(section,/route\.draft_deleted/);
 assert.match(section,/insert into audit_logs/);
 assert.match(section,/status='cancelled'/);
});
test('cancelamento não remove físicamente visitas ou registros de trabalho',()=>{
 const route=read('app/api/rotas/[id]/route.ts');
 const section=route.slice(route.indexOf('export async function DELETE'),route.indexOf('export async function PUT'));
 assert.doesNotMatch(section,/delete from routes|delete from route_stops|delete from visits/i);
 assert.match(section,/result\?\.changed!==1\|\|result\?\.recorded!==1/);
 const list=read('app/api/rotas/route.ts');
 assert.match(list,/where r\.status<>'cancelled'/);
});
test('cards só mostram Editar e Excluir em rascunhos para gestor',()=>{
 const page=read('app/rotas/page.tsx');
 assert.match(page,/canPlan&&r\.status==='draft'/);
 assert.match(page,/className="routes-draft-edit"/);
 assert.match(page,/className="routes-draft-delete"/);
 assert.match(page,/method:'DELETE'/);
 assert.match(page,/edit_token:detail\.route\.edit_token/);
 assert.match(page,/window\.confirm/);
 assert.match(page,/await reload\(\)/);
});
test('atalho Editar abre editor existente e respeita permissão do usuário',()=>{
 const page=read('app/rotas/[id]/page.tsx');
 assert.match(page,/meta\.stored_status!=='draft'/);
 assert.match(page,/canManage/);
 assert.match(page,/new URLSearchParams\(window\.location\.search\)\.get\('editar'\)/);
 assert.match(page,/setEditing\(true\)/);
 assert.match(page,/<RouteCompanyEditor/);
});
