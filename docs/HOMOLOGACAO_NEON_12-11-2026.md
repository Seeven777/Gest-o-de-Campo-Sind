# Homologação do MODO ROTEIRIZADOR — 12/11/2026

## Situação verificada em 11/11/2026
- Os PRs #22 (GPS), #23 (Cadastro) e #24 (RH/reembolsos) já constam como **mesclados no GitHub main** por operação externa à auditoria atual.
- Main consultada: `4cec604910a9a432155d1f79860fe36bf5821657`.
- Último deployment **Production** encontrado no momento da consulta: commit `e6b9f1d44cddd8ea2d3314d3fa3451f7836a1018` (anterior à nova main); verificar novamente amanhã, não presumir que continue igual.
- Bancos Neon consultados **somente leitura**:
  - **PRODUÇÃO:** projeto `seeven-mkt`, branch `main` / ID `br-small-glitter-b63jmwzk`.
  - **QA/PREVIEW:** branch `preview` / ID `br-quiet-morning-b62b1q3e`.
  - Nenhum dos dois possui `registration_records.official_verified_at`, novas colunas de `expenses` ou tabela `expense_events`.
  - As 3 constraints de cargos ainda aceitam apenas `admin`, `supervisor`, `agent`.
- **Risco:** realizar deployment da nova main antes das migrações 008/009 quebrará Cadastro, RH, Empresas, mapa e indicadores. Não publicar até regularizar.
- PR de refinamentos de prevenção: **#25**, branch `fix/pre-homologacao-integridade-20261111`; manter em draft até homologação.

## Antes de executar qualquer SQL
1. Verificar em **Neon → seeven-mkt → Branches** que a branch selecionada é **preview** (`br-quiet-morning-b62b1q3e`), **NÃO** main.
2. Preparar backup/snapshot recuperável da branch de testes; registrar data, branch e responsável. Não usar a base principal nem importar os >200 mil CNPJs.
3. Conferir que os scripts são exatamente:
   - `neon/008_perfil_cadastro.sql`: novos cargos e verificação oficial de cadastro.
   - `neon/009_rh_reembolsos.sql`: novo cargo RH, estados, documentos e auditoria.
4. **Somente após aprovação explícita:** executar **008 primeiro**, depois **009**, no SQL Editor da branch de QA. São duas transações distintas; ao ocorrer erro, parar e verificar, nunca ignorar ou repetir sem analisar.
5. Não executar em main/produção nesta etapa.

## Verificação de compatibilidade após as migrações
- Na sessão de administrador do Preview com o código do PR #25, consultar `GET /api/admin/prontidao`: deve retornar `ready:true`, sem segredos.
- Verificar por consultas read-only:
  ```sql
  SELECT to_regclass('public.expense_events') AS expense_events;
  SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='registration_records'
   AND column_name='official_verified_at';
  SELECT conrelid::regclass,conname,pg_get_constraintdef(oid)
   FROM pg_constraint WHERE conname IN
    ('app_profiles_role_check','access_requests_assigned_role_check','access_invitations_role_check');
  ```
- O diagnóstico positivo valida **estrutura**, não afirma que pagamentos e acessos foram testados.

## Vercel Preview seguro
1. **Branch do PR #25** tem `DATABASE_URL` e `DATABASE_NEON_AUTH_BASE_URL` específicos da branch de **Preview**, vinculados a `br-quiet-morning-b62b1q3e`. Conferir antes de testar.
2. Após atualização de variáveis, fazer **novo deployment** do commit HEAD da branch; deployment antigo pode ter sido criado antes do isolamento e NÃO é seguro para testes com escrita.
3. Conferir domínio de QA no Neon Auth/Better Auth — trusted domain — para permitir login nos testes.
4. O token `BLOB_READ_WRITE_TOKEN` pode permanecer compartilhado entre Production e Preview: **não enviar fotos** até isolar o armazenamento de evidências.
5. A Vercel Hobby pode limitar deploys no dia: caso ocorra HTTP 402, não usar produção como atalho nem pagar sem decisão do titular.

## Checklist funcional — teste com cinco cargos
- **Agente:** recebe rota publicada, inicia GPS, percorre, chega com veículo parado, registra formulário. Concluir rota A e iniciar B imediatamente sem recarregar. GPS negado, timeout e reativação devem ter mensagens distintas.
- **Supervisor:** aprova/rejeita ou pede correção de visita. Empresa só vai para fila Cadastro após aprovação e situação validada.
- **Cadastro:** só vê fila validada, informa referência oficial e confirma. Registros antigos apenas marcados `confirmed` sem conferência permanecem na fila.
- **RH:** recebe nota física, confere destinatário, emissor e arquivo, registra aprovação contábil externa, pagamento efetivamente executado. Não pode aprovar gasto próprio antigo.
- **Agente — reembolso:** solicita durante sua rota, pode acompanhar, receber devolução, corrigir, confirmar valor recebido ou contestar. Reenvio após falha de rede não duplica pedido.
- **Admin:** acompanha indicadores, ajusta funções, vê histórico e diagnóstico; **não** deve marcar pagamentos como realizados.
- **Segurança:** Cargo Cadastro/RH não acessa APIs de rotas, localização, visitas ou relatórios de campo; Supervisor não acessa transições financeiras; usuário não acessa gastos de outro agente.
- **Fiscal:** testar documentos reais somente em ambiente autorizado/isolado. Regras de validade e guarda devem ser aprovadas por RH e contabilidade. Aplicativo não emite NF nem transfere valores.

## Critérios para avançar à produção
- CI do commit exato verde e Preview isolado READY **após** configurar variáveis.
- Migrações aplicadas com sucesso na QA; quatro etapas do fluxo e cinco permissões verificadas com registros sintéticos.
- Procedimento de auditoria/reembolso, retenção documental e comprovante bancário aprovado por RH/contabilidade.
- Backup do Neon Production e autorização específica antes de aplicar 008 e 009 na **main**; validar prontidão após migrar; só então fazer deployment de produção.
- Base externa com >200 mil empresas permanece fora do Neon gratuito; API/ngrok em etapa separada, com busca paginada.

## Limites desta auditoria
A CI executa TypeScript, ESLint, build Next.js e smoke HTTP sem sessões autenticadas. NÃO executa mudanças de banco, pagamentos, GPS físico, fotos nem testes ponta a ponta. Nenhum desses resultados deve ser descrito como homologação funcional concluída.
