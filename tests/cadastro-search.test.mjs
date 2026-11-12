import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCnpjSearch} from '../lib/cadastro-search.ts';

test('CNPJ numérico com máscara e sem máscara produz o mesmo termo',()=>{
 assert.equal(normalizeCnpjSearch('12.345.678/0001-90'),'12345678000190');
 assert.equal(normalizeCnpjSearch('12345678000190'),'12345678000190');
});
test('CNPJ alfanumérico preserva letras e normaliza caixa',()=>{
 assert.equal(normalizeCnpjSearch('ab.cde.fg1/2345-hi'),'ABCDEFG12345HI');
 assert.equal(normalizeCnpjSearch('AB CDE FG1 2345 HI'),'ABCDEFG12345HI');
});
test('termo vazio e caracteres de pontuação não injetam coringas SQL',()=>{
 assert.equal(normalizeCnpjSearch(''), '');
 assert.equal(normalizeCnpjSearch('%%__-./'), '');
});

import {canReadCadastroHistory,canConfirmCadastro} from '../lib/cadastro-permissions.ts';

test('apenas Cadastro e Admin confirmam e visualizam a fila',()=>{
 for(const role of ['admin','cadastro']){
  assert.equal(canConfirmCadastro(role),true,role);
  assert.equal(canReadCadastroHistory(role),true,role);
 }
});
test('Supervisor lê histórico mas não pode confirmar',()=>{
 assert.equal(canReadCadastroHistory('supervisor'),true);
 assert.equal(canConfirmCadastro('supervisor'),false);
});
test('Agente e RH não acessam dados de Cadastro',()=>{
 for(const role of ['agent','rh','', 'unknown']){
  assert.equal(canReadCadastroHistory(role),false,role);
  assert.equal(canConfirmCadastro(role),false,role);
 }
});
