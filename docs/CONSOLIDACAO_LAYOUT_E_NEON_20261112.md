# MODO ROTEIRIZADOR — consolidação de navegação e preparação Neon (12/11/2026)

## Objetivo
Reduzir a quantidade de entradas visíveis na navegação **sem remover módulos, histórico ou permissões**. O conceito do produto continua sendo captação de empresas e métricas territoriais.

## Nova organização de funções
- **Início**: visão da operação e próximos passos.
- **Campo**: rotas, visitas e validação de informações. A jornada do agente mantém a tela de mapa exclusiva quando está em condução.
- **Captação**: empresas, cadastro sindical confirmado, cobertura dos 645 municípios e indicadores.
- **Gestão**: equipe/acessos, reembolso/RH, localização e importação. Por cargo, exibir apenas o que o servidor permite.
- **Conta**: configurações e perfil.
- Dock inferior usa quatro áreas principais e “Mais”; abas de contexto aparecem dentro das páginas. As URLs antigas continuam válidas. Nenhuma função foi excluída.

## Estado do banco (somente leitura, 12/11/2026)
- Neon projeto seeven-mkt `cold-sunset-93973446`: banco principal branch `br-small-glitter-b63jmwzk`; QA `br-quiet-morning-b62b1q3e`.
- QA ainda não possui `registration_records.official_verified_at` nem `expense_events`; permissões no banco ainda permitem apenas admin, supervisor, agent.
- Há confirmação sindical antiga sem a nova marcação de conferência oficial; não realizar atualização retroativa fictícia.
- Nenhuma migração foi executada nesta consolidação.

## Compatibilidade parcial sem 008
- Dashboard, lista de empresas e mapa devem continuar mostrando dados operacionais existentes: empresas, rotas, visitas, situação de campo.
- Indicadores de cadastro oficialmente confirmado não devem mostrar **zero** quando a funcionalidade não está pronta; use indicador indisponível.
- Módulos de confirmação sindical e reembolso continuam protegidos e só habilitam operações após as migrações corretas.
- Aviso técnico da preparação do banco fica concentrado em Configurações do administrador; painel mostra uma única mensagem sucinta.

## Procedimento para homologação **somente após autorização explícita**
1. Abrir Neon, confirmar **branch QA** `br-quiet-morning-b62b1q3e` (nunca `main`).
2. Criar backup/snapshot restaurável da branch QA e conferir as constraints existentes.
3. Aplicar o script versionado `neon/008_perfil_cadastro.sql` no QA. Conferir cargos e `official_verified_at`.
4. Aplicar `neon/009_rh_reembolsos.sql` no QA. Conferir novos campos, estados e `expense_events`.
5. Consultar `GET /api/admin/prontidao` em Preview isolado. Exigir `ready:true`.
6. Revalidar visualmente as abas e testar fluxos com os cinco cargos, sem fotos enquanto o Blob estiver compartilhado.
7. Somente com aprovação após testes discutir backup/migração da produção.

## Critérios de aceite do layout
- Administrador encontra Rotas, Visitas, Validações em **Campo**; Empresas, Cadastro, Mapa, Indicadores em **Captação**; Equipe/RH/Localização/Importação em **Gestão**.
- Supervisor não vê aprovação financeira ou gestão de acessos sem permissão.
- Agente tem acesso direto a Meu dia, Rotas, Visitas, Despesas; mapa em condução continua sem navegação extra.
- Cadastro e RH mantêm a tela principal do trabalho e Meu perfil, sem links a módulos não autorizados.
- Mobile possui abas roláveis, no mínimo 43-45 px de área de toque, foco visível e dock sem funções duplicadas.
- Nenhum deploy até CI verde do commit consolidado; não publicar na produção sem homologação.
