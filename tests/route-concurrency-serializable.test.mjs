import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('criação verifica disponibilidade e grava em transação serializável',()=>{
 const src=read('app/api/rotas/route.ts');
 const post=src.slice(src.indexOf('export async function POST'),src.indexOf('export async function PATCH'));
 assert.match(post,/sql\.transaction\(\[/);
 assert.match(post,/isolationLevel:'Serializable'/);
 assert.match(post,/with available as \(/);
 assert.match(post,/select not exists \(/);
 assert.match(post,/from available where available\.ok returning id/);
 assert.match(post,/from available where \$1::uuid is null and available\.ok returning id/);
 assert.match(post,/insert into route_stops/);
 assert.match(post,/insert into audit_logs/);
 assert.match(post,/if\(!route\)return fail\('Uma empresa foi atribuída a outra rota nessa data/);
 assert.match(post,/40001\|23505/);
});
test('edição reconfirma disponibilidade dentro da mesma transação serializável',()=>{
 const src=read('app/api/rotas/[id]/route.ts');
 const put=src.slice(src.indexOf('export async function PUT'));
 assert.match(put,/other_route\.id<>r\.id/);
 assert.match(put,/other_route\.route_date=r\.route_date/);
 assert.match(put,/other_route\.status<>'cancelled'/);
 assert.match(put,/other_stop\.establishment_id=any\(\$3::uuid\[\]\)/);
 assert.match(put,/\[id,token,ids\]/);
 assert.match(put,/isolationLevel:'Serializable'/);
 assert.match(put,/40001\|23505/);
 assert.match(put,/current_setting\('app\.route_edit_permitted',true\)='yes'/);
});
test('falha por concorrência sinaliza conflito e permite atualizar o planejador',()=>{
 const create=read('app/api/rotas/route.ts');
 const edit=read('app/api/rotas/[id]/route.ts');
 assert.match(create,/tente novamente\.',409\)/);
 assert.match(edit,/Atualize a rota e tente novamente\.',409\)/);
 assert.match(edit,/route\.stops_edited/);
 assert.match(create,/route\.created/);
});
