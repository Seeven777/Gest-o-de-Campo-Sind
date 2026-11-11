#!/usr/bin/env node
/**
 * Smoke HTTP de páginas — não substitui testes autenticados de GPS/Neon/Blob.
 * Uso: npm run test:smoke (com servidor Next em http://127.0.0.1:3100)
 */
import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3100';
const pages=[
 '/', '/login', '/aguardando', '/redefinir-senha', '/convite',
 '/dashboard','/agente','/empresas','/campanhas','/cadastros',
 '/rotas','/visitas','/validacoes','/reembolsos',
 '/mapa','/localizacoes','/equipes','/relatorios','/importacoes','/configuracoes','/limpeza'
];
const assets=['/sind-login-desktop.webp','/sind-login-mobile.webp'];
async function check(path){
 const res=await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(12000)});
 if(![200,301,302,303,307,308].includes(res.status))
  throw Error(`GET ${path}: HTTP ${res.status}`);
 if(res.status===200){
  if(path.endsWith('.webp')){
   assert.match(res.headers.get('content-type')||'',/image\/webp/i,`Content-type incorrecto para ${path}`);
   const bytes=(await res.arrayBuffer()).byteLength;
   assert.ok(bytes>1000,`Imagem vazia: ${path}`);
  }else{
   const html=await res.text();
   assert.ok(html.includes('<html'),`HTML ausente em ${path}`);
   // O App Router embute "This page could not be found." no payload RSC
   // mesmo quando a página existe e retorna HTTP 200. Uma busca de texto
   // produz falsos 404 em TODAS as páginas. O código HTTP é a fonte de verdade.
   assert.ok(!html.includes('<title>404</title>'),`Página 404 efetivamente renderizada em ${path}`);
  }
 }
 console.log('OK',res.status,path);
}
let failed=0;
for(const path of [...pages,...assets]){
 try{await check(path)}catch(e){failed++;console.error('FALHA',path,e instanceof Error?e.message:e)}
}
if(failed){console.error(`${failed} falha(s) no smoke HTTP.`);process.exit(1)}
console.log(`Smoke concluído: ${pages.length} páginas + ${assets.length} imagens.`);
