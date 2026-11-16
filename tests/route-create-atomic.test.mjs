import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('criação registra auditoria e paradas numa única consulta atômica',()=>{
 const api=read('app/api/rotas/route.ts');
 const create=api.slice(api.indexOf('export async function POST'),api.indexOf('export async function PATCH'));
 assert.match(create,/with automatic_campaign as \(/);
 assert.match(create,/new_route as \(/);
 assert.match(create,/new_stops as \(/);
 assert.match(create,/recorded as \(/);
 assert.match(create,/insert into audit_logs\(actor_id,action,details\)/);
 assert.match(create,/jsonb_build_object\('id',new_route\.id,'count'/);
 assert.match(create,/\(select count\(\*\)::int from recorded\) as recorded/);
 assert.match(create,/Number\(route\.recorded\)!==1/);
 assert.doesNotMatch(create,/await db\(\)\.query\('insert into audit_logs/);
});
test('criação rejeita identificadores inválidos e exige região única',()=>{
 const api=read('app/api/rotas/route.ts');
 const create=api.slice(api.indexOf('export async function POST'),api.indexOf('export async function PATCH'));
 assert.match(api,/const uuid=\/\^\[0-9a-f\]\{8\}/);
 assert.match(create,/campaign&&!uuid\.test\(campaign\)/);
 assert.match(create,/stops\.some\(\(x:string\)=>!uuid\.test\(x\)\)/);
 assert.match(create,/new Set\(stops\)\.size!==stops\.length/);
 assert.match(create,/assessNeighborhoodSelection\(check\.map/);
 assert.match(create,/r\.status<>'cancelled'/);
});
test('criação mantém autorização e proteção por origem',()=>{
 const api=read('app/api/rotas/route.ts');
 const create=api.slice(api.indexOf('export async function POST'),api.indexOf('export async function PATCH'));
 assert.match(create,/currentIdentity\(\)/);
 assert.match(create,/\['admin','supervisor'\]/);
 assert.match(create,/Origem não autorizada/);
});
