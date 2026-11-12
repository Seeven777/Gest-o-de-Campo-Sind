# MODO ROTEIRIZADOR — interface da Equipe (12/11/2026)

## Referência visual
Implementação baseada nas seis telas fornecidas em 12/11/2026, preservando o tema cinza, branco e laranja: `tela 2.jpg` e `tela 2.2` até `tela 2.6`. A tela de login **não foi alterada**.

## Objetivo do cargo Agente / Equipe
Somente o fluxo essencial, sem painéis administrativos e sem interromper a direção com informações excessivas:

1. **Minhas rotas** — mostra quantas estão disponíveis e o botão Iniciar percurso. O agente pode escolher entre duas ou mais rotas atribuídas, sem acesso a outras equipes.
2. **Iniciar percurso** — ao tocar, calcula a ordem das visitas (usa a otimização já existente), obtém consentimento para GPS na própria ação e inicia o monitoramento ligado ao ID da rota. Se falhar, mantém a ação de tentar novamente; não requer atualizar a página.
3. **Navegação** — mapa real Leaflet/OSM, trecho do serviço ORS quando disponível, próxima orientação e distância. Uma ação principal `CHEGUEI!` com o veículo parado; sinal impreciso permite `AJUSTAR GPS` e não simula chegada.
4. **Chegada / Foto** — confirmação de presença vinculada à empresa, check-in autenticado, foto da fachada via armazenamento privado já existente; sem nova API paralela que bypassaria os controles atuais. Não fotografar pessoas ou documentos.
5. **Quatro perguntas rápidas + observações** — Endereço, funcionamento, setor pet, identificação visível. O campo técnico de condições observadas fica opcional na última pergunta e assume `not_evaluated` quando a equipe não o preenche. A API existente recebe os cinco campos obrigatórios; respostas só são enviadas depois da foto.
6. **Enviado à central** — confirmação **de entrega**, nunca indicação de que a visita já foi aprovada. O agente escolhe Próximo percurso; se terminou a rota, volta à tela de rotas disponíveis. A central prossegue com validação ou solicitação de correção.

## Ações secundárias durante o percurso
- **Relatório pessoal**: abre resumo da própria rota, com visitas registradas, sem uma tela gerencial.
- **Solicitar parada**: abre formulário de alimentação, necessidade pessoal, abastecimento ou outro motivo; grava pedido auditável em `audit_logs` associado ao agente/rota. O registro não interrompe o GPS, não concede autorização automática e **não substitui intervalos trabalhistas devidos**.
- O backend `/api/campo/parada` oferece consulta pelo titular e pela central e decisão via PATCH restrita a admin/supervisor, com evento de auditoria separado. A central recebe um painel compacto em `/validacoes` (sem criar nova tela gerencial).

## Preservações
- Autenticação e permissões em `Portal`, `currentIdentity` e APIs mantidas.
- Link de saída da conta na home; o login e a imagem do login não mudam.
- O painel e as rotas de supervisor/admin, Cadastro e RH permanecem intactos, salvo a leitura e decisão das solicitações de parada em Validações.
- GPS, check-in, fotografia e formulários usam os mesmos contratos de backend anteriores.
- **Nenhum SQL de migração novo** e nenhuma alteração na base de produção.
- Não fazer upload de fotos reais no Preview até isolar o token Vercel Blob, como observado na homologação anterior.

## Checklist de homologação
- Acesso de agente: não apresenta Gestão/Cadastros nem menus de outras funções.
- Abre uma rota atribuída; calcula percurso; GPS negado/sem sinal; reativação de GPS.
- Confirmar chegada somente com veículo parado; API registra visita exatamente uma vez.
- Foto JPEG enviada ao Blob privado; questionário não conclui sem foto.
- Quatro perguntas e observações; servidor recebe `regularity_note` válido; revisão pode solicitar correção.
- Enviar visita → mensagem de entrega → próxima empresa sem refresh; última visita → rota concluída.
- Abrir relatório resumido; registrar parada, verificar status pendente, central autorizar/recusar e agente consultar status.
- Testes em mobile e desktop, inclusividade de toque, sem interações que incentivem manipular telas ao dirigir.
- Build e CI do commit exato. Deploy apenas para Preview com banco QA isolado e sem merge de produção.
