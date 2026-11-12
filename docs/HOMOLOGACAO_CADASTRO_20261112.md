# MODO ROTEIRIZADOR — estado real de homologação do Cadastro (12/11/2026)

## Ambientes verificados em leitura
- **Neon:** projeto `seeven-mkt` (`cold-sunset-93973446`).
- **QA:** branch `br-quiet-morning-b62b1q3e`. Migrações 008 e 009 **já aplicadas**: coluna `registration_records.official_verified_at`, tabela `expense_events`, campos de `expenses` e três constraints de cargos contendo `cadastro` e `rh`. Não reaplicar como se estivessem pendentes.
- **Produção:** branch `br-small-glitter-b63jmwzk`. **Ainda faltam 008 e 009**. Permissões no banco só admitem admin/supervisor/agent; não autorizar o Cadastro nem o RH nesse ambiente.
- **Backup QA existente:** `br-plain-leaf-b61xajat`, `backup/qa-antes-008-009-20261112`. Mantê-lo intacto.
- **Vercel:** PR #33 foi mesclado na main pelo commit `a573275c`; deployment Production está READY para esse commit. READY comprova o build, **não** compatibilidade do banco.
- **CI:** o workflow main do commit `a573275c` terminou com sucesso.

## Dados e acesso de QA conferidos
- Empresas validadas em campo: **2**.
- Na fila de confirmação sindical: **2**.
- Oficialmente verificadas: **0**.
- Confirmação legada sem verificação oficial: **1** (não deve contar como confirmada).
- Cargos ativos: admin **3**, supervisor **1**, agent **1**, cadastro **0**, rh **0**.
- Não há solicitação de acesso pendente.

## Pré-requisitos de teste do Cadastro
1. Conferir que o novo Preview Vercel usa banco e Neon Auth **QA**. O domínio antigo de preview do PR #33 já consta entre as origens confiáveis do Neon Auth QA; para qualquer nova URL, verificar também a origem. **Nunca testar POST sem verificar a conexão de banco.**
2. Criar uma conta *realmente controlada pelo testador* na autenticação QA e aprová-la como cargo `cadastro` usando a administração do QA. Não aproveitar conta de colaborador nem atribuir cargo via SQL direto.
3. Entrar como Cadastro e conferir somente a fila validada e histórico; verificar busca por CNPJ com e sem máscara e por empresa/município.
4. Confirmar uma das empresas **somente usando dados de teste**: localizar/verificar no sistema de homologação da base sindical ou definir um cenário sintético, informar referência QA e conferir o checkbox. Não afirmar que uma empresa real foi cadastrada na base oficial sem conferência.
5. Checar atualização de contadores, trilha `audit_logs`, autoria, `official_verified_at`, bloqueio de confirmação concorrente/duplicada e manutenção do item legado como pendente até nova revisão.
6. Testar Supervisor (histórico sem POST), Agente e RH (403 para API Cadastro), Admin (permissão), sessão ausente (401).
7. Retestar responsividade no tablet e no celular. Smoke e build **não** substituem teste autenticado.

## Produção: não executar automaticamente
Antes das migrações de produção, requer aprovação específica, snapshot recuperável, conferência de tabelas/constraints, janela controlada e procedimento de reversão. Os scripts versionados são `neon/008_perfil_cadastro.sql` e `neon/009_rh_reembolsos.sql`, nessa ordem. Os endpoints bloqueiam funções não prontas com HTTP 503; a página de Configurações informa o ambiente e as etapas corretamente.

## Limites deste ciclo
A conexão externa com a base de >200 mil empresas segue **não implementada**. A confirmação do Cadastro é **manual**. Nenhuma pessoa recebeu cargo novo, nenhum pagamento foi registrado, nenhuma migração foi executada em produção e nenhuma alteração foi aplicada ao banco QA nesta verificação.
