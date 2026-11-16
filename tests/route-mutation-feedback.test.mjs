import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {refreshAfterSuccessfulMutation} from '../lib/route-mutation-feedback.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('atualização bem-sucedida retorna verdadeiro',async()=>{
 let refreshed=0;
 assert.equal(await refreshAfterSuccessfulMutation(async()=>{refreshed++}),true);
 assert.equal(refreshed,1);
});
test('falha ao atualizar não é confundida com falha na gravação',async()=>{
 let refreshed=0;
 assert.equal(await refreshAfterSuccessfulMutation(async()=>{refreshed++;throw Error('Rede indisponível')}),false);
 assert.equal(refreshed,1);
});
test('criação, publicação e exclusão preservam sucesso após falha de refresh',()=>{
 const src=read('app/rotas/page.tsx');
 assert.match(src,/async function refreshAfterMutation\(\)\{\s*const refreshed=await refreshAfterSuccessfulMutation\(reload\)/);
 assert.match(src,/A operação foi concluída, mas a lista não atualizou/);
 assert.match(src,/setMessage\('Rota criada com '[\s\S]*?await refreshAfterMutation\(\)/);
 assert.match(src,/setMessage\('Rascunho excluído\.[\s\S]*?await refreshAfterMutation\(\)/);
 assert.match(src,/setMessage\('Rota publicada com[\s\S]*?await refreshAfterMutation\(\)/);
});
test('ações concorrentes no mesmo navegador são bloqueadas imediatamente',()=>{
 const src=read('app/rotas/page.tsx');
 assert.match(src,/mutationInFlight=useRef\(false\)/);
 assert.match(src,/if\(mutationInFlight\.current\|\|!agent/);
 assert.match(src,/if\(route\.status!=='draft'\|\|mutationInFlight\.current\)return/);
 assert.match(src,/async function publish\(id:string\)\{\s*if\(mutationInFlight\.current\)return/);
 assert.match(src,/mutationInFlight\.current=true;setBusy\(true\)/);
 assert.equal((src.match(/mutationInFlight\.current=false;setBusy\(false\)/g)||[]).length,3);
});
