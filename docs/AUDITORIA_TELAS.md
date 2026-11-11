# Auditoria de telas e fluxos — MODO ROTEIRIZADOR

Atualizada em 11/11/2026. Branch: `fix/modo-roteirizador-auditoria-ux`. Registro operacional e verificável; não declarar tudo funcional sem percorrer os estados autenticados.

## Níveis de validação

- **Código**: rota e controle de acesso revisados no GitHub.
- **CI**: TypeScript, ESLint e compilação Next.js.
- **Smoke**: servidor HTTP acessível, páginas não retornam 404 e fotografias de login carregam.
- **E2E real**: operação no navegador logado por perfis, permissão GPS/câmera, banco, upload, mudança de parada, central; requer contas adequadas e teste manual ou Playwright autenticado.

**Importante:** CI e smoke NÃO provam o funcionamento das funcionalidades com dados reais.

| Tela | URL | Avaliação/ação nesta etapa | Teste pendente |
|---|---|---|---|
| Acesso | /login | Foto desktop e mobile versionada, layout responsivo revisado | Entrar com conta ativa, senha errada, mobile real |
| Criação de conta | /login (aba) | Preserva validação, solicitação e role exclusivamente no servidor | E-mail e perfil pendente sem acesso interno |
| Recuperar senha | /login (aba) | Mantém Neon Auth e retorno de sucesso/erro | E-mail real, redirect confiável e expiração |
| Redefinir senha | /redefinir-senha | Página presente, token query/hash, erro e confirmação | Link real do Neon Auth sem 404 |
| Solicitação | /aguardando | Página presente e leitura de `/api/access-requests` | Aprovação/recusa com usuários distintos |
| Convites | /convite | Página pública testável por HTTP | Convite expira/revogação/redeem |
| Início central | /dashboard | Smoke e módulo de métricas | Totais conferidos na base |
| Meu dia | /agente | Smoke e acesso por papel | Rota ativa/publicada + próxima parada |
| Empresas | /empresas | Código/API revisados; filtro inválido devolve 400 | Paginação, CNAE, CNPJ, duplicata e estados vazios |
| Campanhas | /campanhas | Código/API revisados; validação devolve 400 | Criar, filtrar, período e orçamento |
| Cadastros sindicais | /cadastros | Backend exige admin para alterar | Confirmação manual e auditoria |
| Rotas | /rotas | Corrigida detecção de papel; 49 paradas inseridas de forma atômica | Criar/publicar, limite, reentrada e conflito |
| Percurso | /rotas/[id] | Backend preservado | Endereços sem coordenadas, quota e mapa |
| Visitas | /visitas | GET por agente, POST legado bloqueado | Foto obrigatória, formulário e próxima visita |
| Jornada guiada | /campo/[id] | Acesso restrito à rota atribuída; layout mobile do projeto preservado | Teste no celular com GPS/câmera, pin e swipe |
| Validações | /validacoes | Backend e fluxo de foto revisados estaticamente | Aprovar/recusar, evidência, expurgo após análise |
| Despesas | /reembolsos | Agente não pode enviar despesa em campanha sem rota própria | Lançar, aprovar, rejeitar e recibos |
| Mapa de cobertura | /mapa | Smoke e API de território | Dados por município, render e performance |
| GPS equipe | /localizacoes | API tem escopo de agente e central; dados recentes | Consentimento, frequência, perda de sinal |
| Equipes | /equipes | Só administrador aprova cadastros no servidor | Permissão por perfil e segurança da troca |
| Relatórios | /relatorios | Corrigido vazamento dos custos de outros agentes; CSV preservado | Valores, escopo, download |
| Importações | /importacoes | Lotes inválidos devolvem erro 400, não 500 | CSV inválido/duplicado, log |
| Configurações | /configuracoes | Diferencia perfil e módulo administrativo | Atualização do perfil e recuperação |
| Limpeza de testes | /limpeza | API exige admin e confirmação | Prévia e exclusão **somente** com autorização |
| Menu e dock | Global | Visual preto e laranja; opções por papel; jornada imersiva sem dock | Tab/teclado, iOS safe-area e menu Mais |

## Correções encontradas durante a auditoria

1. **Imagem ausente no login**: duas fotos WebP locais incorporadas, removida dependência da URL não confiável, CSS reorganizado.
2. **Respostas falsas de sucesso**: `withRole` agora retorna HTTP 400 quando o módulo sinaliza `{error:...}`, evitando mensagens de operação concluída após falha.
3. **Roteiro por papel**: `/rotas` agora consulta `/api/me`, não infere agente de falhas nas APIs administrativas; agentes não carregam listas desnecessárias.
4. **Criação incompleta de rotas**: inserção de uma rota e até 49 paradas no mesmo SQL atômico.
5. **Privacidade de relatórios**: agentes recebem somente campanhas com rotas atribuídas e despesas próprias.
6. **Despesa não atribuída**: bloqueada tentativa do agente de lançar custo em campanha alheia.
7. **Importação inválida**: lote vazio, fora do limite ou item inválido não deve gerar erro 500.
8. **CI legado**: removida permissão de escrita e modificação automática do lockfile; incluída verificação HTTP de 21 páginas e de ambas as fotografias.
9. **Identidade dos painéis**: dock escuro com contraste e laranja, mantendo mecanismos de autorização existentes.

## Pendências de homologação real

- **CI: passou** na execução `43056342215` (TypeScript, ESLint, Next build e smoke HTTP). O smoke havia falhado por buscar a mensagem de 404 no payload RSC de páginas válidas; agora considera status HTTP e título 404 efetivo.
- Publicar Preview com conexão ao Neon **isolada** do banco de produção.
- Validar pessoalmente foto, geolocalização, acesso, recuperação de senha e fluxos de cada papel, pois a autenticação real e as permissões do celular não podem ser simuladas por smoke HTTP.
- Monitorar erros de servidor por logs da Vercel quando disponíveis. Em Hobby, retenção é curta; não inferir ausência de erros quando log indisponível.
- Levantar problemas da UI com imagens reais de cada tela e corrigir contraste, textos, estados e sobreposição.
- Testar fluxo de até 49 empresas em uma mesma rota usando dados de Preview.
- Implementar papel Marketing apenas com política de permissões definida no servidor e telas específicas.
- Limpar dados de teste **somente após confirmação explícita**; depois planejar base externa/ngrok.


## Revisão complementar de 11/11/2026

10. **Smoke do Next.js**: corrigido falso 404 causado pelo texto de fallback no payload de React Server Components; CI verde.
11. **Rotas por link direto**: rota em rascunho não pode ser consultada por agente, mesmo conhecendo o UUID.
12. **GPS inválido**: check-in e telemetria recusam coordenadas ausentes, nulas ou não numéricas, impedindo conversão de `null` para `0,0`.
13. **Campanhas e reembolsos**: agente só vê como disponíveis campanhas com rota atribuída e publicada (ou já iniciada/concluída), e o servidor impõe a mesma restrição ao salvar despesa.
14. **Responsividade em Campanhas**: removida grade forçada de duas colunas em telas pequenas; campos, botões e tabelas têm regras de legibilidade/tamanho mínimo no mobile.
15. **Visitas com sessão inválida**: não chama API administrativa como fallback quando `/api/me` falha; exibe erro e instrução de reconexão em vez de lista vazia.

### Limitações não mascaradas por CI
- E2E real: revisão de visita, foto, GPS, aprovação, navegação orientada e recuperação de senha depende de contas reais e permissões do dispositivo.
- Concorrência de múltiplos check-ins no mesmo `stop_id`: esquema inicial não possui constraint `unique(stop_id)` em `visits`. A proteção `where not exists` pode sofrer corrida. Recomenda-se migração aditiva em branch Neon de teste, com análise prévia de duplicados; **não aplicar automaticamente à produção**.
- Não confundir Preview READY com teste de funcionalidades: é necessário conferir autenticação com os três perfis.

## Verificação do Neon e dos logs (somente leitura)

- Branch de Preview consultada: `br-quiet-morning-b62b1q3e` (não é a principal). Contagem: 1.848 empresas, 2 rotas, 4 visitas, 5 perfis, 1 visita ainda em andamento e 1 parada sem coordenada. Check-ins duplicados por parada: 0.
- Logs de produção das últimas 24h incluem erros **históricos** de migrações não instaladas (GPS, notas de revisão e expurgo). Consulta posterior do esquema mostrou que as colunas e a tabela de GPS **já existem** nos bancos principal e Preview; portanto não tratar esses logs anteriores como erro ainda ativo.
- **Pendência confirmada:** `admin_delete_test_record(text,uuid,text)` não existe nem no Neon principal nem no Preview. O endpoint passou a informar `deletion_available=false` e a interface desabilita exclusões em vez de apresentar erro genérico. Aplicação de `neon/005_limpeza_segura.sql` permanece para etapa futura, após backup e aprovação.
- **Tela Visitas do agente corrigida:** além da lista de jornadas para novo registro, apresenta agora o histórico próprio de visitas e o status de revisão.
- A limitação diária da Vercel impediu novo deploy manual do commit mais recente (HTTP 402 `api-deployments-free-per-day`). Deploy anterior READY não equivale à versão atual. CI no GitHub permanece como validação não autenticada.

## Continuação: consistência e segurança operacional (11/11/2026)

- **Check-in simultâneo:** reserva da parada via atualização condicional `pending → arrived` e criação de visita/log no mesmo comando SQL. Segundo check-in recebe conflito; migração com unicidade em `visits(stop_id)` segue recomendada como defesa adicional, apenas após análise dos dados.
- **Finalização:** respostas, conclusão e status da parada + log gravados atomicamente. Ao reenviar visita solicitada para ajuste, limpa metadados da decisão anterior.
- **GPS de navegação:** endpoint de trecho rejeita `null` e campos ausentes em vez de convertê-los em coordenadas zero. Ping após 15 minutos sem atualização não responde falsamente como posição transmitida; exige reiniciar com consentimento.
- **Fotos:** foto expirada não conta como foto válida; o agente pode reenviar a fachada se ela expirou durante uma visita aberta. Limpeza programada elimina só imagens vencidas de visitas pendentes, preservando eventual imagem nova; análise concluída continua removendo todas as imagens.
- **Empresas para agente:** listagem não revela empresas associadas apenas a rotas em rascunho ou canceladas.

**Validação:** revisão estática do código; executar CI no commit e repetir os testes autenticados no Preview antes de qualquer merge. Nenhum banco ou dado de produção foi modificado nesta correção.

### Ajustes de navegação e estados de rede (11/11/2026)
- O portal diferencia falha de rede/servidor na consulta de sessão de um acesso realmente negado e oferece ação de nova tentativa. Falhas transitórias não são mais tratadas silenciosamente como perfil sem permissão.
- O link da marca retorna o agente a **Meu dia** sem abrir o dashboard administrativo primeiro.
- Depois de login aprovado, a navegação reconhece o perfil e encaminha o agente diretamente a `/agente`.
- Nova validação: TypeScript, lint, build, smoke e Preview; confirmar funcionamento autenticado por perfil antes de merge.

### Correções de telas de planejamento e campo (11/11/2026)
- Empresas: ação de importação visível somente para administração/supervisão; listagem não mantém resultados antigos quando uma consulta falha; legenda diferencia base de trabalho de dados definitivos; maior legibilidade dos nomes.
- Rotas: etiquetas de situação em português e ações coerentes com jornada iniciada/concluída; campo de busca adapta-se no celular e seleção de empresas tem linhas de toque maiores.
- Reembolsos: ações de aprovação exigem perfil confirmado de admin/supervisor, sem assumir autorização em caso de falha da sessão; erros ao carregar campanhas deixam de ser silenciosos; situações em português e aviso quando não há campanhas atribuídas.
- Nenhum acesso administrativo foi concedido no cliente: as restrições de servidor continuam sendo a fonte de verdade.

### Conclusão e reabertura de jornada; segurança de convites (11/11/2026)
- A última parada concluída marca a rota como `completed` no mesmo SQL que registra as respostas, desde que todas as demais paradas estejam `visited`. O dashboard passa a mostrar a rota como concluída.
- Quando a central solicita ajustes (`needs_more`), a parada volta para `arrived` e uma rota antes concluída é reaberta em `in_progress` no mesmo comando que registra a decisão. Isso permite ao agente reenviar as respostas e retomar o GPS mediante consentimento.
- Aceitar um convite exige uma conta Neon Auth com **e-mail verificado** e exatamente igual ao convite. O critério é aplicado dentro do próprio SQL que consome o token, protegendo inclusive convites de administrador.
- Mudanças pendentes de CI, de homologação autenticada e de Preview, sem aplicação de migrações ou alterações em bancos.
