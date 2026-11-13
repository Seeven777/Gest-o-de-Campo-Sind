# Homologação QA — Roteirizador (13/11/2026)

**Escopo:** PR #42 e regressões pós-PR #39. Ambiente: Vercel Preview do commit exato, conectado exclusivamente a Neon QA + Neon Auth QA. Não usar dados de produção nem executar migrações/limpeza.

## Antes de testar

- Conferir no painel Vercel que `DATABASE_URL` e `DATABASE_NEON_AUTH_BASE_URL` são overrides exclusivos da branch, associados ao banco **QA**. Não abrir valores de credenciais em logs.
- Verificar que as contas de teste pertencem a **Neon Auth QA**. Contas de produção não existem necessariamente no ambiente de teste.
- O token `BLOB_READ_WRITE_TOKEN` ainda é compartilhado entre Preview e Production: **não enviar fotos reais de fachadas ou documentos**. A homologação de foto deve aguardar armazenamento segregado.
- Não executar a rota no trânsito. Tablet e câmera devem ser operados com o veículo estacionado.

## Matriz de aceitação

| Caso | Perfil | Passos | Resultado esperado |
|---|---|---|---|
| QA-01 | Admin | Entrar em QA e abrir Rotas | Lista correta, sem erro inesperado |
| QA-02 | Supervisor | Criar rascunho com 2 empresas QA | Uma rota com duas paradas, sem duplicidade |
| QA-03 | Supervisor | Editar rascunho; incluir, remover e reordenar | Salva e recarrega sem erro de data nem perda de IDs preservados |
| QA-04 | Supervisor | Abrir mesma rota em duas abas; salvar na A e depois na B | A salva; B recebe HTTP 409 com texto de conflito |
| QA-05 | Supervisor | Publicar rota de múltiplos municípios | Aviso de dispersão antes de publicação, quando aplicável; conferir alerta #43 sobre enforcement no servidor |
| QA-06 | Agente | Tentar editar rota via PUT | HTTP 403, nenhuma alteração persistida |
| QA-07 | Agente | Tentar abrir rascunho por URL | HTTP 404 ou resposta de acesso negado, sem revelar paradas |
| QA-08 | Admin | Avaliar 1 ponto válido e 4 inválidos no QA | Cobertura 20%; somente o válido no mapa; nenhuma distância inventada |
| QA-09 | Admin | Avaliar rota apenas com coordenadas inválidas | Cobertura 0%; mapa sem pontos; risco indefinido e aviso de localização |
| QA-10 | Admin | Testar empresas com coordenadas válidas e separação longa | Alerta de dispersão; distâncias identificadas como linha reta |
| QA-11 | Agente | Concluir última visita de rota controlada | Rota some das disponíveis; retorna à home sem F5 e GPS encerra |
| QA-12 | Central | Solicitar ajuste em visita concluída | Rota volta ao agente apenas quando há visita a corrigir |
| QA-13 | RH/Cadastro | Abrir endpoints de edição de rotas | HTTP 403; sem acesso à gestão de percursos |
| QA-14 | Agente | Abrir Waze, voltar ao sistema em local seguro | Reconsulta de estado e recuperação de GPS, sem duplicidade de visita |

## Evidências por cenário

Para cada caso registrar: perfil (sem identificar trabalhador), ambiente `preview`, SHA, sistema operacional/navegador, resultado (passou/falhou/bloqueado), hora, mensagem HTTP e screenshot com dados pessoais ocultos. Não registrar localização pessoal exata ou tokens.

## Critério de promoção

- CI de mesmo SHA aprovada; Preview READY no mesmo SHA.
- QA-01 a QA-10 e QA-13 sem falhas P0; QA-11, QA-12 e QA-14 homologados antes de liberar jornada real.
- Correções com falha demonstrada em branch; voltar à CI após novo commit.
- PR #42 restrito a normalização da cobertura; o enforcement na publicação é separado na Issue #43.
- Não confundir build/smoke com E2E autenticado; produção permanece inalterada até liberação.
