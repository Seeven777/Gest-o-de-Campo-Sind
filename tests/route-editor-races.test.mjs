import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {neighborhoodKey} from '../lib/route-neighborhood.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('editor cancela pesquisas obsoletas ao buscar, trocar região ou desmontar',()=>{
 const editor=read('components/route-company-editor.tsx');
 assert.match(editor,/const pendingSearch=useRef<AbortController\|null>\(null\)/);
 assert.match(editor,/pendingSearch\.current\?\.abort\(\)/);
 assert.match(editor,/signal:controller\.signal/);
 assert.match(editor,/if\(!controller\.signal\.aborted\)\{setResults/);
 assert.match(editor,/if\(!controller\.signal\.aborted\)setError/);
 assert.match(editor,/return\(\)=>\{controller\.abort\(\);pendingSearch\.current\?\.abort\(\)\}/);
 assert.match(editor,/\[city,district,date,routeId\]/);
 assert.match(editor,/aria-busy=\{loading\}/);
 assert.match(editor,/disabled=\{loading\|\|busy\|\|\(!ids\.includes\(company\.id\)/);
});
test('sugestões fora do bairro são bloqueadas antes de alterar paradas',()=>{
 const editor=read('components/route-company-editor.tsx');
 assert.match(editor,/singleArea&&neighborhoodKey\(item\)!==neighborhoodKey\(\{city,district\}\)/);
 assert.match(editor,/Crie um roteiro separado/);
 assert.equal(neighborhoodKey({city:'São Paulo',district:'Pinheiros'}),neighborhoodKey({city:'Sao Paulo',district:'PINHEIROS'}));
 assert.notEqual(neighborhoodKey({city:'São Paulo',district:'Pinheiros'}),neighborhoodKey({city:'São Paulo',district:'Moema'}));
});
test('permissões de edição e exclusão continuam verificadas pelo servidor',()=>{
 const api=read('app/api/rotas/[id]/route.ts');
 assert.match(api,/if\(!\['admin','supervisor'\]\.includes\(user\.role\)\)/);
 assert.match(api,/r\.status='draft'/);
 assert.match(api,/agent_live_presence gps/);
 assert.match(api,/assessNeighborhoodEdit\(originalLocations,newLocations\)/);
});
