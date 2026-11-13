import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('dashboard utiliza dados reais da API e não indicadores inventados',()=>{
 const page=source('app/dashboard/page.tsx');
 assert.match(page,/fetch\('\/api\/overview'/);
 assert.match(page,/registrationReady/);
 assert.match(page,/approved_expenses/);
 assert.match(page,/currency\(data.approved_expenses\)/);
 assert.doesNotMatch(page,/Math\.random/);
});
test('atalhos de administração respeitam o cargo e não exibem RH ao supervisor',()=>{
 const page=source('app/dashboard/page.tsx');
 assert.match(page,/const admin=role==='admin'/);
 assert.match(page,/admin&&<Link href="\/reembolsos"/);
 assert.match(page,/admin&&<Link href="\/equipes"/);
 assert.match(page,/href:admin\?'\/cadastros':'\/validacoes'/);
});
test('painel oferece atualização manual com estado de carregamento',()=>{
 const page=source('app/dashboard/page.tsx');
 assert.match(page,/setRefreshKey\(n=>n\+1\)/);
 assert.match(page,/aria-busy=\{loading\}/);
 assert.match(page,/role="alert"/);
});
test('dashboard acessível com responsividade e animação reduzida',()=>{
 const css=source('app/dashboard/overview.css');
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
});
