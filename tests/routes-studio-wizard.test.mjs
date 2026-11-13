import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('wizard de rotas guia por região equipe empresas e revisão',()=>{
 const page=source('app/rotas/page.tsx');
 for(const label of ["Região","Equipe","Empresas","Revisão"])assert.match(page,new RegExp("label:'"+label+"'"));
 assert.match(page,/const \[showForm,setShowForm\]=useState\(false\),\[step,setStep\]=useState\(0\)/);
 assert.match(page,/step===0&&/);
 assert.match(page,/step===1&&/);
 assert.match(page,/step===2&&/);
 assert.match(page,/step===3&&/);
 assert.match(page,/disabled=\{!canNext\|\|busy\}/);
 assert.match(page,/aria-current=\{step===i\?'step':undefined\}/);
});
test('wizard mantém obrigatoriedade, bloqueio de criação indevida e revisão do rascunho',()=>{
 const page=source('app/rotas/page.tsx');
 assert.match(page,/const regionReady=Boolean\(city&&district\)/);
 assert.match(page,/const teamReady=Boolean\(agent&&date\)/);
 assert.match(page,/const companiesReady=selected\.length>0&&selected\.length<=49/);
 assert.match(page,/disabled=\{busy\|\|!selected.length\|\|!agent\|\|!date\|\|!city\|\|!district\}/);
 assert.match(page,/method:'POST'/);
 assert.match(page,/establishment_ids:selected/);
 assert.match(page,/RouteProximityPanel selectedIds=\{selected\}/);
 assert.match(page,/Rota criada com/);
});
test('busca é feita na etapa pertinente e municípios repetidos usam cache',()=>{
 const page=source('app/rotas/page.tsx');
 assert.match(page,/districtCache=useRef\(new Map/);
 assert.match(page,/districtCache\.current\.get\(next\)/);
 assert.match(page,/districtCache\.current\.set\(next/);
 assert.match(page,/step===1&&regionReady&&teamReady&&city&&district\)void findCompanies/);
 assert.match(page,/companyRequest\.current\+\+/);
});
test('animações com hierarquia visual, foco e redução de movimento',()=>{
 const css=source('app/rotas/rotas.css');
 assert.match(css, /@keyframes rw-scene/);
 assert.match(css, /@keyframes rw-item/);
 assert.match(css, /\.routes-wizard-meter/);
 assert.match(css, /\.routes-review-grid/);
 assert.match(css, /\.routes-wizard-footer/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /:focus-visible/);
 assert.match(css, /@media\(max-width:650px\)/);
});
test('navegação em campo permanece distinta da interface administrativa',()=>{
 const page=source('app/rotas/page.tsx');
 assert.match(page,/const canPlan=role==='admin'\|\|role==='supervisor'/);
 assert.match(page,/\{canPlan&&<section/);
 assert.match(page,/role==='agent'\?'\/campo\/':'\/rotas\/'/);
});
