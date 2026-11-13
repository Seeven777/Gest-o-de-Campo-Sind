import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const screens=[
 'app/empresas/page.tsx',
 'app/equipes/page.tsx',
 'app/reembolsos/page.tsx',
 'app/visitas/page.tsx',
 'app/validacoes/page.tsx',
 'app/relatorios/page.tsx',
 'app/mapa/page.tsx',
 'app/configuracoes/page.tsx',
 'app/importacoes/page.tsx',
 'app/localizacoes/page.tsx',
 'app/limpeza/page.tsx',
 'app/rotas/[id]/page.tsx',
];
test('interfaces operacionais reutilizam o mesmo cabeçalho Studio',()=>{
 for(const path of screens){
  const s=source(path);
  assert.match(s,/import \{StudioPageBanner\} from '@\/components\/studio-page-banner'/,path);
  assert.match(s,/<StudioPageBanner eyebrow=/,path);
  assert.match(s,/<Portal /,path);
 }
});
test('componentes compartilhados não dependem de dados falsos e mantêm semântica',()=>{
 const s=source('components/studio-page-banner.tsx');
 assert.match(s,/type LucideIcon/);
 assert.match(s,/aria-label=\{title\}/);
 assert.match(s,/\{description\}/);
 assert.match(s,/\{title\}/);
});
test('camada visual é global e não interfere na jornada imersiva do agente',()=>{
 const layout=source('app/layout.tsx');
 const css=source('app/studio-unified.css');
 assert.match(layout,/studio-unified.css/);
 assert.match(css,/\.app-shell:not\(\.journey-shell\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/studio-page-banner/);
 assert.match(css,/studio-visit-route/);
});
test('perfil mantém dados reais e as decisões de acesso permanecem em suas telas',()=>{
 const cfg=source('app/configuracoes/page.tsx');
 const teams=source('app/equipes/page.tsx');
 assert.match(cfg,/data\?\.profile\.name/);
 assert.match(cfg,/roleNames\[data\?\.profile\.role/);
 assert.match(cfg,/studio-profile-identity/);
 assert.match(teams,/decide\(r,'approve'\)/);
});
test('visitas preservam início de jornada e validações preservam decisões',()=>{
 const visits=source('app/visitas/page.tsx');
 const validation=source('app/validacoes/page.tsx');
 assert.match(visits,/href=\{'\/campo\/'\+r.id\}/);
 assert.match(visits,/studio-visit-route/);
 assert.match(validation,/decide\(x.id,'approved'\)/);
 assert.match(validation,/decide\(x.id,'rejected'\)/);
});
