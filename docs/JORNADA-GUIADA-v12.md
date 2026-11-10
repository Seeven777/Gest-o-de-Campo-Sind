# SindPetshop-SP — Jornada Guiada v1.2
**Status:** versão de teste, não colocar em produção antes da homologação com agentes e central. Nenhuma tabela foi alterada no Neon por esta entrega de código. A integração externa com Pet_dados/ngrok permanece FORA DO ESCOPO.

## Funcionalidades do agente
1. Rotas > Iniciar jornada, página `/campo/[id]`: tela simplificada com empresas, botões grandes, uma etapa por vez.
2. Calcular trajeto (openrouteservice e Leaflet existentes); se o serviço falhar, mostrar coordenadas disponíveis e aviso, nunca inventar distância.
3. Iniciar jornada habilita GPS com consentimento explícito; indicador de localização ativa e botão persistente para interromper. GPS acompanha a posição no mapa enquanto a página estiver visível. Envia somente a última coordenada a cada ~20–25s, sem trajetória histórica.
4. Ao chegar: deslizar para confirmar (ou tocar no botão acessível) e gravar check-in horário/GPS.
5. Tirar foto da fachada (input camera). Foto comprimida pelo navegador (JPEG até 1280px/2MB), sem metadados EXIF, salva no **Vercel Blob PRIVADO**, nunca em storage público.
6. Perguntas: funcionando?, identificação visível?, situação aparente de regularidade?, observações. Não é uma fiscalização formal.
7. Enviar à central, voltar ao mapa, visitar próxima empresa.

## Central
- `/validacoes`: foto via URL proxy autenticada, resultado, respostas, observações, distância aproximada entre check-in e coordenada da empresa, aprovação/recusa/devolução para ajustes.
- Após aprovar ou recusar, o backend deleta o blob fisicamente e marca `deleted_at`. Se falhar, `cleanup_pending` é retornado e a rotina automática tentará novamente.
- `/localizacoes`: lista + mapa dos agentes com consentimento e localização recebida nos últimos **dois minutos**, atualiza a cada 15s. Apenas administradores/supervisores.
- Não há coleta de trilha, mapa de histórico, nem rastreamento fora da jornada.

## Pré-requisitos ANTES de testar em Preview
1. Criar backup/branch separada no **Neon vinculado ao projeto gest-o-de-campo-sind**. Execute `neon/006_jornada_gps_evidencias.sql` no SQL Editor. Não executar no outro projeto Neon nem em produção sem backup. O SQL cria `agent_live_presence` e colunas adicionais, preservando registros existentes.
2. Criar/associar um **Vercel Blob privado** ao projeto (região sugerida gru1). O conector Vercel já registrou `BLOB_READ_WRITE_TOKEN` nas variáveis do projeto. Verifique a conexão em Storage.
3. Adicionar `CRON_SECRET` (segredo longo e aleatório gerado no painel) à Vercel como variável sensível e disparar redeploy para autorizar `/api/cron/limpar-fotos`.
4. Confirmar `DATABASE_URL`, `OPENROUTESERVICE_API_KEY`, Neon Auth e que a URL de Preview NÃO usa o banco de produção ao realizar testes de exclusão/validação. A migração pode ser aplicada de modo compatível à produção quando autorizada.
5. Instalar/atualizar dependências e `package-lock.json` com `npm install`; verificar `npm run typecheck`, `npm run build` e `npm run lint`. O novo pacote é `@vercel/blob` (versão >=2.3 para private Blob). Não desproteger o token nem publicá-lo no GitHub.

## Exclusão de fotos
- Deletar imediatamente após aprovação ou recusa na API de validação.
- Manter por no máximo 14 dias desde upload; cron diário **03:00 UTC** remove fotos expiradas e tenta novamente as de visitas já analisadas (configurar `CRON_SECRET`).
- Foto pode ser removida antes da análise caso a central ultrapasse o prazo; visitas antigas sem foto permanecem identificadas como tal.
- Apenas o backend autenticado serve `GET /api/campo/foto/[id]` com cache privado/no-store. Nunca retornar URL pública do Blob.
- Para dados pessoais e evidências, validar finalidade, informação aos trabalhadores, política de retenção e controles de acesso segundo LGPD antes da produção.

## Limitações honestas
- É um mapa integrado no navegador que acompanha o ponto GPS, **não um navegador com voz/manobras ou trânsito em tempo real como Waze**. Para alertas curva a curva e GPS em segundo plano/telefone bloqueado, será necessário um app móvel/SDK de navegação apropriado.
- Navegadores podem suspender o GPS com a tela desligada, aba fechada ou aplicativo em segundo plano. O sistema mostra a posição como desatualizada após 2 minutos; não alega rastreamento contínuo.
- GPS e foto ajudam a conferir a ida, mas podem estar imprecisos ou ser manipulados; revisão humana continua necessária.
- Não atualizar a base de empresas via ngrok, nem alterar cadastros sindicais definitivos.
- Não há suporte offline; uma jornada exige rede e GPS autorizados.

## Roteiro mínimo de homologação
1. Conta de teste agente, rota publicada com 2 empresas de teste, smartphone com GPS e HTTPS.
2. Calcular, iniciar e verificar na central `/localizacoes` o agente e a atualização recente.
3. Com o aparelho parado por mais de 1 min, verificar heartbeat.
4. Desligar GPS/encerrar, verificar desaparecimento do painel em menos de 2 min.
5. Confirmar chegada; tirar foto e concluir perguntas; verificar que aparece na central.
6. Tentar concluir sem foto — deve ser bloqueado.
7. Central pede ajuste, agente reenvia; central aprova; verificar foto indisponível após decisão e `deleted_at` no Neon.
8. Verificar que visitante não autenticado e outro agente não acessam fotos, rotas e localização.
9. Conferir em celular com texto ampliado, leitor de tela e baixo sinal (testar erros e recuperação).
10. Testar cron com segredo; verificar não permanência da foto após TTL.
