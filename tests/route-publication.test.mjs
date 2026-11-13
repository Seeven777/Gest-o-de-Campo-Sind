import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requiresTerritoryConfirmation,validPublicationConfirmation} from '../lib/route-publication.ts';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const assessment=(risk='compact',coverage=100,cities=['São Paulo'],warnings=[])=>({
 risk,coverage,cities:cities.map(city=>({city,count:1})),warnings
});
const token='a'.repeat(32);

test('uma rota compacta e inteiramente localizada não requer confirmação',()=>{
 assert.equal(requiresTerritoryConfirmation(assessment(),3),false);
});
test('rota dispersa ou com múltiplos municípios exige confirmação',()=>{
 assert.equal(requiresTerritoryConfirmation(assessment('high'),3),true);
 assert.equal(requiresTerritoryConfirmation(assessment('attention'),3),true);
 assert.equal(requiresTerritoryConfirmation(assessment('compact',100,['São Paulo','Campinas']),3),true);
});
test('cobertura incompleta ou dia com mais de vinte empresas exige revisão',()=>{
 assert.equal(requiresTerritoryConfirmation(assessment('unknown',50),4),true);
 assert.equal(requiresTerritoryConfirmation(assessment('unknown',0),1),false);
 assert.equal(requiresTerritoryConfirmation(assessment(),21),true);
});
test('a confirmação precisa ser explícita e associada à versão vigente',()=>{
 assert.equal(validPublicationConfirmation(true,token,token),true);
 assert.equal(validPublicationConfirmation('true',token,token),false);
 assert.equal(validPublicationConfirmation(true,'b'.repeat(32),token),false);
 assert.equal(validPublicationConfirmation(true,'',token),false);
 assert.equal(validPublicationConfirmation(false,token,token),false);
});
test('a API verifica risco e usa atualização versionada com auditoria atômica',()=>{
 const api=source('app/api/rotas/route.ts');
 assert.match(api,/requiresTerritoryConfirmation\(assessment,stops.length\)/);
 assert.match(api,/requires_confirmation:true,edit_token:route.edit_token/);
 assert.match(api,/validPublicationConfirmation\(data.territory_confirmed,data.edit_token/);
 assert.match(api,/md5\(coalesce\(\(select string_agg/);
 assert.match(api,/with changed as \(/);
 assert.match(api,/recorded as \(/);
 assert.match(api,/route.published/);
 assert.match(api,/not exists\(select 1 from agent_live_presence/);
});
test('interface apresenta revisão fornecida pelo servidor e envia token confirmado',()=>{
 const page=source('app/rotas/page.tsx');
 assert.match(page,/payload.requires_confirmation/);
 assert.match(page,/request\(true,payload.edit_token\)/);
 assert.match(page,/window.confirm/);
});
