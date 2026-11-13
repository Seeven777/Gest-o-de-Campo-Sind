import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Empresas mantém busca simples e filtros avançados opcionais',()=>{
 const page=source('app/empresas/page.tsx');
 assert.match(page,/const \[advanced,setAdvanced\]/);
 assert.match(page,/aria-expanded=\{advanced\}/);
 assert.match(page,/ops-company-filters/);
 assert.match(page,/ops-mobile-details/);
 assert.match(page,/setFilters\(\{city:'',cnae:'',status:''\}\)/);
});
test('Jornada do agente continua em destaque e histórico pode ser recolhido',()=>{
 const page=source('app/visitas/page.tsx');
 assert.match(page,/href=\{'\/campo\/'\+r.id\}/);
 assert.match(page,/aria-expanded=\{showHistory\}/);
 assert.match(page,/showHistory&&<>/);
});
test('Validação preserva fotografia, resposta técnica, GPS e botões de decisão',()=>{
 const page=source('app/validacoes/page.tsx');
 assert.match(page,/ops-review-details/);
 assert.match(page,/ops-review-priority/);
 assert.match(page,/x.distance_m!==null/);
 assert.match(page,/decide\(x.id,'approved'\)/);
 assert.match(page,/decide\(x.id,'needs_more'\)/);
 assert.match(page,/decide\(x.id,'rejected'\)/);
});
test('Relatórios mostra apenas valores reais e mantém exportação CSV',()=>{
 const page=source('app/relatorios/page.tsx');
 assert.match(page,/fetch\('\/api\/relatorios'/);
 assert.match(page,/href="\/api\/relatorios\?format=csv"/);
 assert.match(page,/aria-expanded=\{expanded\}/);
 assert.match(page,/totals=rows.reduce/);
 assert.match(page,/não equivalem necessariamente/);
});
test('Estilo comum prioriza mobile e respeita acessibilidade',()=>{
 const page=source('app/layout.tsx'),css=source('app/operations-simplified.css');
 assert.match(page,/operations-simplified.css/);
 assert.match(css, /@media\(max-width:740px\)/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /:focus-visible/);
});
