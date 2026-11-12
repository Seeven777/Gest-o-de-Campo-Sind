import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getRoleReadinessStatus} from '../lib/role-editor.ts';

test('cargos atuais sempre permitem seleção mesmo com diagnóstico indisponível',()=>{
 for(const role of ['agent','supervisor','admin'])assert.equal(getRoleReadinessStatus(role,null,true),'ready');
});
test('cargos novos têm estados distintos durante verificação, bloqueio e prontidão',()=>{
 assert.equal(getRoleReadinessStatus('rh',null),'loading');
 assert.equal(getRoleReadinessStatus('rh',null,true),'unavailable');
 assert.equal(getRoleReadinessStatus('cadastro',{cadastro:true,rh:false}),'ready');
 assert.equal(getRoleReadinessStatus('rh',{cadastro:true,rh:false}),'unavailable');
 assert.equal(getRoleReadinessStatus('rh',{cadastro:true,rh:true}),'ready');
});
test('seletor não desabilita opções de cargos, apenas valida o salvamento',()=>{
 const page=readFileSync(new URL('../app/equipes/page.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(page,/<option[^>]*disabled=/);
 assert.match(page,/setProfileRoles\(/);
 assert.match(page,/roleHelp\(/);
});
