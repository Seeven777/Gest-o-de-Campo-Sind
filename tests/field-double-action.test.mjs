import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('app/campo/[id]/page.tsx');

test('chegada impede duplicação entre toques anteriores ao render',()=>{
 const part=page.slice(page.indexOf('async function arrive()'),page.indexOf('async function uploadPhoto('));
 assert.match(page,/visitMutation=useRef\(false\),photoUpload=useRef\(false\)/);
 assert.match(part,/if\(!current\|\|busy\|\|visitMutation\.current\)return/);
 assert.match(part,/visitMutation\.current=true/);
 assert.match(part,/action:'arrive'/);
 assert.match(part,/finally\{visitMutation\.current=false;setArrivalPhase\(null\);setBusy\(false\)\}/);
});
test('foto só tem um upload pendente por visita no tablet',()=>{
 const part=page.slice(page.indexOf('async function uploadPhoto('),page.indexOf('async function finish('));
 assert.match(part,/if\(!file\|\|!current\?\.visit_id\|\|photoUpload\.current\)return/);
 assert.match(part,/photoUpload\.current=true;setPhotoBusy\(true\)/);
 assert.match(part,/form\.append\('visit_id',current\.visit_id\)/);
 assert.match(part,/finally\{photoUpload\.current=false;setPhotoBusy\(false\)\}/);
});
test('envio das respostas impede duplicação e conserva respostas em falha',()=>{
 const part=page.slice(page.indexOf('async function finish('),page.indexOf('const answer='));
 assert.match(part,/if\(!current\?\.visit_id\|\|busy\|\|visitMutation\.current/);
 assert.match(part,/visitMutation\.current=true/);
 assert.match(part,/action:'finish'/);
 assert.match(part,/finally\{visitMutation\.current=false;setBusy\(false\)\}/);
 assert.match(part,/Suas respostas continuam na tela/);
});
test('servidor mantém defesa idempotente independentemente da interface',()=>{
 const visit=read('app/api/campo/visita/route.ts');
 const photo=read('app/api/campo/foto/route.ts');
 assert.match(visit,/already_registered:true/);
 assert.match(visit,/s\.status='pending'/);
 assert.match(photo,/already_uploaded:true/);
});
