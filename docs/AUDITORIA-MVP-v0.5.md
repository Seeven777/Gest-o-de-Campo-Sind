# SindPetshop-SP — Auditoria operacional (MVP v0.5)

Auditoria de código realizada em 10/11/2026, **sem executar testes autenticados no banco de produção**. A referência de esquema é `neon/001_init.sql`; nenhum comando de exclusão/migração destrutiva foi executado. Os 1.848 registros da base existente permanecem como dados de teste.

| Aba | Antes | Alteração nesta branch | Limitação / teste obrigatório |
|---|---|---|---|
| Visão geral | Contadores reais | Mantida | Confirmar discrepâncias nos totais após gerar visitas |
| Empresas | Busca livre e paginação | Filtros CNAE, município e situação | Verificar pesquisas sem resultados e escala |
| Campanhas | Criação de rascunhos | Mantida | Ativação/encerramento de campanhas ainda não implementados |
| Rotas | Página ilustrativa | Criação manual, seleção por busca, publicação, detalhe e link para mapa por endereço | Não otimiza paradas, não calcula tempo, sem agendamento recorrente |
| Visitas | Página ilustrativa | Consulta de paradas, check-in GPS, conclusão com resultado/observações | Fotos, checkout GPS e antisspoofing ainda pendentes |
| Validações | Página ilustrativa | Aprovação, rejeição, solicitação de revisão e status territorial | Fotos ainda não disponíveis; não considere prova fotográfica validada |
| Despesas / Reembolsos | Página ilustrativa | Registro de gastos, análise, marcação administrativa de pagamento | Comprovantes, limites, prestação de contas e transferência real não implementados |
| Cadastros sindicais | Não existia | Atualização manual separada do resultado de visita | Somente admin; referência interna obrigatória para confirmação |
| Inteligência territorial | Página ilustrativa | Comparativo por cidade: identificadas, validadas e confirmadas | Mapa geométrico e série histórica ainda pendentes |
| Pessoas & Acessos | Aprovação por perfil | Mantida; permissões servidor mantidas | Teste de conta agente/supervisor/admin |
| Relatórios | Página ilustrativa | Resumo de campanha e exportação CSV | Metas, séries e detalhamento financeiro ainda pendentes |
| Importações | CSV e CNPJ | Preservada | Não reimportar dados reais em testes sem backup |
| Configurações | Página ilustrativa | Dados de perfil e regras administrativas | Edição de políticas ainda pendente |
| Catálogo externo | Inexistente | Código experimental isolado e oculto no menu | DEFERIDO: configurar e validar API Pet_dados/ngrok posteriormente |

## Fluxo de teste proposto
1. Criar campanha com período atual.
2. Criar conta de teste como agente, verificar e-mail, aprovar como agente na área Pessoas & Acessos.
3. Em Rotas, pesquisar e selecionar 2 empresas da base existente; atribuir a campanha e agente; publicar rota.
4. Acessar a plataforma como agente (ou celular), consultar rota e permitir GPS. Fazer check-in e concluir visita.
5. Voltar como supervisor/admin e revisar a visita; verificar alteração de `field_status`.
6. Cadastrar um gasto de combustível ou alimentação como agente e analisá-lo na administração.
7. Como admin, confirmar o cadastro sindical de **uma empresa de teste** informando referência interna.
8. Conferir resultados em Inteligência territorial, Visão geral e exportação CSV de Relatórios.
9. Testar que agente não acessa endpoints administrativos nem empresas não atribuídas.

## Segurança e publicação
- A branch é de **Preview**. Não dar merge antes de testar com dois usuários e dados fictícios ou controlados.
- GPS é dado pessoal: informar finalidade, evitar coleta contínua, aplicar retenção e permissões por papel.
- Nenhuma foto é recebida; o comprovante físico deve ser mantido até armazenamento privado ser implantado.
- Não configurar túnel ngrok nem conectar banco externo nesta rodada.
- O catálogo externo/ngrok foi retirado deste PR; nenhum endpoint ou variável de integração externa foi adicionado.
- Despesas `paid` são marcações administrativas, não integração bancária.
- Roteirização significa ordenação manual e links de navegação nesta fase, não algoritmo de caminho ótimo.

## Problemas em aberto para produção real
- Armazenamento seguro de fotos e comprovantes (evidências), com upload restrito, visualização autorizada e exclusão/retencão.
- Publicação/encerramento de campanha, metas e calendário, além de controle de orçamento.
- Otimização de rotas por distância/tempo e atribuições em lote.
- Geocodificação, mapa geográfico, IBGE e histórico temporal de cobertura.
- Alertas/notificações e reatribuição de tarefas.
- Testes integrados sob autenticação, cobertura contra concorrência nas rotas e auditoria de operações críticas.
