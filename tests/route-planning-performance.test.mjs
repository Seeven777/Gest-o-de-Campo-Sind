import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addVisibleStops} from '../lib/route-bulk-selection.ts';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('seleção em lote preserva ordem, ignora duplicidades e respeita 49',()=>{
 const first=['a','b'],next=addVisibleStops(first,['b','c','c','d']);
 assert.deepEqual(next,['a','b','c','d']);
 assert.deepEqual(first,['a','b']);
 assert.equal(addVisibleStops([],Array.from({length:70},(_,i)=>String(i))).length,49);
 assert.deepEqual(addVisibleStops(['a','b'],['c','d'],3),['a','b','c']);
 assert.deepEqual(addVisibleStops(['a'],['','a']),['a']);
});
test('diagnóstico só consulta servidor quando painel é aberto',()=>{
 const s=source('components/route-proximity-panel.tsx');
 assert.match(s,/if\(!selectedIds\.length\|\|!expanded\)/);
 assert.match(s,/aria-expanded=\{expanded\}/);
 assert.match(s,/onClick=\{\(\)=>setExpanded\(v=>!v\)\}/);
 assert.match(s,/ctrl\.abort\(\)/);
});
test('busca do planejador exclui empresa agendada na mesma data e evita joins desnecessários',()=>{
 const api=source('app/api/companies/route.ts');
 assert.match(api,/availableOn/);
 assert.match(api,/route\.route_date=\$\{availableParam\}::date/);
 assert.match(api,/route\.status<>'cancelled'/);
 assert.match(api,/planning\?false:await isSchemaReady\('cadastro'\)/);
 assert.match(api,/\$\{planning\?'':"left join registration_records/);
});
test('busca em lote e atalhos respeitam data, Enter e bairro escolhido',()=>{
 const page=source('app/rotas/page.tsx');
 assert.match(page,/available_on:areaDate,purpose:'route'/);
 assert.match(page,/addVisibleStops\(selected,companies\.map/);
 assert.match(page,/onKeyDown=\{e=>\{if\(e\.key==='Enter'/);
 assert.match(page,/changeDate\(e\.target\.value\)/);
 assert.match(page,/setSelected\(\[\]\)/);
});
test('edição exclui outras rotas mas conserva paradas do roteiro atual',()=>{
 const editor=source('components/route-company-editor.tsx');
 assert.match(editor,/available_on:date,except_route:routeId,purpose:'route'/);
});
