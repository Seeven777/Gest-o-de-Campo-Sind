import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const load=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('repetição de check-in devolve visita existente em vez de duplicá-la',()=>{
 const src=load('app/api/campo/visita/route.ts');
 assert.match(src,/if\(existing\)return NextResponse\.json\(\{id:existing\.id,already_registered:true\}/);
});
test('repetição de conclusão devolve resultado anterior mesmo com rota encerrada',()=>{
 const src=load('app/api/campo/visita/route.ts');
 assert.match(src,/if\(action==='finish'\)\{/);
 assert.match(src,/already_registered:true/);
 assert.match(src,/not exists\(select 1 from route_stops s2/);
});
test('conclusão da rota encerra GPS e central não lista rotas finalizadas',()=>{
 assert.match(load('app/api/campo/visita/route.ts'),/stopped_presence as \(/);
 assert.match(load('app/api/campo/localizacao/route.ts'),/r\.status in \('published','in_progress'\)/);
});
test('repetição do envio de foto não obriga uma nova captura',()=>{
 assert.match(load('app/api/campo/foto/route.ts'),/already_uploaded:true/);
});
test('reimportação incompleta preserva endereços e CNAEs preenchidos',()=>{
 const src=load('app/api/imports/route.ts');
 for(const key of ['trade_name','street','street_number','district','city','state','postal_code','main_cnae'])
 assert.ok(src.includes(`coalesce(nullif(excluded.${key},''),establishments.${key})`),key);
});
test('busca por empresa aceita CNPJ com máscara',()=>{
 assert.match(load('app/api/companies/route.ts'),/regexp_replace\(\$1,'\[\^A-Za-z0-9\]'/);
});
test('contagem de visitas realizadas considera somente encerradas',()=>{
 assert.match(load('app/api/overview/route.ts'),/visits where checkout_at is not null/);
});
