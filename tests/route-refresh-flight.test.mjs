import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteRefreshFlight} from '../lib/route-refresh-flight.ts';
import {readFileSync} from 'node:fs';

test('três eventos simultâneos de visibilidade disparam somente um GET',async()=>{
 const singleFlight=createRouteRefreshFlight();
 let executions=0,resolveFirst;
 const operation=()=>{executions++;return new Promise(resolve=>{resolveFirst=resolve})};
 const calls=[singleFlight(operation),singleFlight(operation),singleFlight(operation)];
 await Promise.resolve();
 assert.equal(executions,1);
 resolveFirst();
 await Promise.all(calls);
 assert.equal(executions,1);
});
test('após terminar, um novo retorno à aba pode atualizar novamente',async()=>{
 const singleFlight=createRouteRefreshFlight();
 let executions=0;
 await singleFlight(async()=>{executions++});
 await singleFlight(async()=>{executions++});
 assert.equal(executions,2);
});
test('falha de rede é compartilhada mas não impede nova tentativa',async()=>{
 const singleFlight=createRouteRefreshFlight();
 let executions=0,failFirst;
 const request=()=>{executions++;return new Promise((_,reject)=>{failFirst=reject})};
 const a=singleFlight(request).catch(e=>e.message);
 const b=singleFlight(request).catch(e=>e.message);
 await Promise.resolve();
 failFirst(Error('Conexão interrompida'));
 assert.deepEqual(await Promise.all([a,b]),['Conexão interrompida','Conexão interrompida']);
 assert.equal(executions,1);
 await singleFlight(async()=>{executions++});
 assert.equal(executions,2);
});
test('página compartilha consulta mas preserva dados selecionados',()=>{
 const s=readFileSync(new URL('../app/rotas/page.tsx',import.meta.url),'utf8');
 assert.match(s,/focusRefresh=useRef\(createRouteRefreshFlight\(\)\)/);
 assert.match(s,/focusRefresh\.current\(reload\)/);
 assert.match(s,/document\.visibilityState==='hidden'/);
 assert.match(s,/mutationInFlight\.current\)return/);
 const effect=s.slice(s.indexOf('// Ao retornar à aba'),s.indexOf('async function findCompanies'));
 assert.doesNotMatch(effect,/setSelected\(|setStep\(|setDistrict\(/);
});
