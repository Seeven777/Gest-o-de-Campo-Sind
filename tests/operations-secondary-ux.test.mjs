import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('RH mantém trilha e pagamento mas deixa referências disponíveis sob demanda',()=>{
 const s=read('app/reembolsos/page.tsx');
 assert.match(s,/expense-record-details/);assert.match(s,/x\.receipt_received_at/);
 assert.match(s,/x\.payment_reference/);assert.match(s,/showHistory\(x.id\)/);
 assert.match(s,/payment_executed=checked/);
});
test('Cadastro mantém a confirmação manual e informa diferença do sistema oficial',()=>{
 const s=read('app/cadastros/page.tsx');
 assert.match(s,/registration-instruction-compact/);
 assert.match(s,/officially_checked:true/);
 assert.match(s,/reference.trim\(\).length<3/);
 assert.match(s,/A conferência acontece no sistema oficial/);
});
test('Equipes preserva fila e mostra contas verificadas sob demanda',()=>{
 const s=read('app/equipes/page.tsx');
 assert.match(s,/staff-verified-collapsible/);
 assert.match(s,/queueVerified\(account\)/);
 assert.match(s,/decide\(r,'approve'\)/);
});
test('Controles recolhíveis têm foco e responsividade',()=>{
 const s=read('app/operations-simplified.css');
 assert.match(s,/expense-record-details summary/);
 assert.match(s,/staff-verified-collapsible summary/);
 assert.match(s,/:focus-visible/);
 assert.match(s,/@media\(max-width:740px\)/);
});
