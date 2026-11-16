import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('salvamento no editor bloqueia cliques repetidos antes de renderizar',()=>{
 const src=read('components/route-company-editor.tsx');
 assert.match(src,/const saveInFlight=useRef\(false\)/);
 assert.match(src,/if\(!changed\|\|saveInFlight\.current\|\|ids\.length===0\)return/);
 assert.match(src,/saveInFlight\.current=true;setBusy\(true\)/);
 assert.match(src,/finally\{saveInFlight\.current=false;setBusy\(false\)\}/);
 assert.match(src,/edit_token:editToken/);
});
test('listagem de rotas se atualiza ao retornar, sem limpar planejamento local',()=>{
 const src=read('app/rotas/page.tsx');
 assert.match(src,/window\.addEventListener\('focus',refresh\)/);
 assert.match(src,/window\.addEventListener\('pageshow',refresh\)/);
 assert.match(src,/document\.addEventListener\('visibilitychange',onVisibility\)/);
 assert.match(src,/document\.visibilityState==='hidden'/);
 assert.match(src,/mutationInFlight\.current\)return/);
 assert.match(src,/window\.removeEventListener\('focus',refresh\)/);
 const effect=src.slice(src.indexOf('// Ao retornar à aba'),src.indexOf('async function findCompanies'));
 assert.doesNotMatch(effect,/setSelected\(|setStep\(|setDistrict\(/);
});

test('listagem descarta respostas e erros antigos após nova consulta',()=>{
 const src=read('app/rotas/page.tsx');
 assert.match(src,/routeListRequest=useRef\(0\)/);
 assert.match(src,/const request=\+\+routeListRequest\.current/);
 assert.match(src,/if\(request===routeListRequest\.current\)setRows\(payload\.items\|\|\[\]\)/);
 assert.match(src,/if\(request===routeListRequest\.current\)throw error/);
 assert.match(src,/const routeRequest=\+\+routeListRequest\.current/);
 assert.match(src,/if\(routeRequest===routeListRequest\.current\)setRows\(list\.items\|\|\[\]\)/);
 assert.match(src,/return\(\)=>\{live=false;routeListRequest\.current\+\+\}/);
});
