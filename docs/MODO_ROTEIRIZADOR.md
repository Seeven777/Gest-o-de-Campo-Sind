# MODO ROTEIRIZADOR — referência central do projeto

> **Palavra-chave de continuidade:** `MODO ROTEIRIZADOR`.
> Quando o usuário mencionar essa expressão, consultar este arquivo e, em seguida, verificar o estado real do GitHub, Neon e Vercel antes de sugerir ou modificar qualquer funcionalidade. Este documento preserva o contexto do projeto; não substitui o estado atual do código, testes ou serviços.

## 1. Visão e propósito

Projeto **SindPetshop-SP · Campo & Território** — plataforma web responsiva de planejamento, gestão territorial, campanhas, roteirização e validação de visitas a empresas do setor pet do Estado de São Paulo. Operada pelo SindPetshop-SP, com forte foco em usabilidade por agentes de campo, inclusive pessoas idosas e com pouca familiaridade com aplicativos.

Objetivo: centralizar ações da equipe sem parecer CRM tradicional. A experiência mobile deve se aproximar da clareza operacional de apps de deslocamento (Waze, Google Maps, Uber, 99) sem copiar marcas ou prometer serviços inexistentes. **Um passo importante por tela**, tipografia acessível, ações grandes, nomes claros, baixo ruído visual e retorno imediato após o toque.

### Escopo de usuários e permissões

Roles reais em `lib/access.ts`: `admin`, `supervisor`, `agent`. Gestão de sessão via Neon Auth + tabela `app_profiles` no Neon/Postgres. Solicitações via `access_requests`; aprovação **exclusiva do admin**, após verificar e-mail, concede perfil e ativação. Agentes jamais podem aprovar ou alterar as próprias permissões. Marketing como perfil próprio é objetivo futuro: **não criar atalhos/autorizações sem modelo de acesso explícito no backend**.

- **Agente de campo**: Meu dia, Minha jornada, confirmar chegada, foto da fachada, formulário de visita, meus resultados, despesas, perfil; visualizar somente as rotas e empresas atribuídas.
- **Supervisor**: acompanhar as equipes, roteiros, visitas e resultados segundo as regras do servidor; não conceder `admin` nem aprovar cadastros sem autorização explícita.
- **Administrador**: gestão global, campanhas, empresas, roteiros, atribuições, validações, acompanhamento e relatórios; configurações e limpeza segura de testes.
- **Marketing** (futuro): campanhas, mapas e indicadores; precisa de role/permissões dedicados, sem reaproveitar `admin` por conveniência.

## 2. Jornada ideal do agente

1. Entrar com senha no sistema; a conta só acessa dados internos depois de aprovação administrativa.
2. Abrir **Meu dia** e receber a próxima rota atribuída com ação óbvia de **Iniciar jornada**.
3. Ver o mapa no próprio aplicativo, com sua localização, paradas numeradas, próxima empresa e trajeto viário sugerido.
4. Iniciar acompanhamento de GPS **com consentimento**, mostrar condição do sinal e atualizar a central durante trabalho.
5. Em trânsito, mostrar a próxima orientação, distância e aproximação; permitir ampliar, centralizar, recalcular e ver empresas usando **menu secundário**.
6. Ao chegar, deslizar **Cheguei** ou usar alternativa acessível por toque. Exibir feedback de processamento, aproveitar posição GPS recente e avançar sem buscar toda a rota novamente.
7. Abrir captura da fachada (com permissão e alternativa de upload), mostrar progresso. Foto privada usada apenas como evidência de visita e eliminada pela rotina de retenção após análise. Não expor URLs públicas ou dados pessoais.
8. Questionário curto, **uma pergunta por vez**, com observações do local, funcionamento, indícios de irregularidade e campo livre, sem induzir conclusão jurídica automática.
9. Enviar ao servidor; mostrar estado de sucesso apenas após resposta confirmada; central valida posteriormente. Seguir imediatamente à **próxima parada**, ou concluir jornada e encerrar GPS no fim.
10. Tratar offline, GPS impreciso, endereço sem coordenadas, falha de API e perda de conexão com mensagens práticas, sem duplicar registros ou perder respostas.

## 3. Roteirização e dados

- A base atual contém aproximadamente **1.848 empresas inseridas para teste** (número relatado pelo usuário, não garantia do volume atual).
- A origem definitiva das empresas deve ser **outra ferramenta/base externa**, consultada por filtros como CNAE, município, região e tipo de empresa. CNAEs de interesse já discutidos: **4789-0/04**, **9609-2/08**, **7500-1/00**.
- Integração externa/ngrok **adiada conscientemente**: primeiro validar toda a ferramenta com os registros de teste. O ngrok é apenas túnel de rede; não é o banco de dados.
- Evitar duplicatas ao importar/sincronizar via CNPJ normalizado, com histórico da fonte, data de atualização e separação entre cadastro-mestre e associação a campanhas.
- Permitir **mais de 20 empresas por dia**; decomposição/otimização escalável por lotes, evitando quotas de terceiros.
- Roteamento com serviço OpenRouteService em endpoint de servidor; API key só no servidor. Distâncias e tempos exibidos são **estimados**, sem trânsito em tempo real. Se faltar coordenada ou houver quota/falha, informar e manter o mapa de paradas com alternativa segura.
- Painel administrativo de **limpeza de testes** requer restrição e confirmação, protegendo registros de produção. Nunca apagar em massa sem autorização explícita.

## 4. Produto e telas a validar

### Públicas e autenticação
- `/login`: entrar, criar conta, recuperar senha, consultar solicitação.
- `/aguardando`: status real da solicitação (pendente, aprovado, recusado) e atualização.
- `/redefinir-senha`: token válido/expirado, confirmar senha sem tela 404, integridade Neon Auth.
- `/convite`: convite controlado por administrador, se mantido.

### Centro de operações
- `/dashboard`: visão geral compreensível e indicadores reais.
- `/empresas`: busca, CNPJ, filtros, detalhes, deduplicação, origem e ações permitidas.
- `/campanhas`: criação, segmentação, status, atribuição, progresso.
- `/cadastros`: registros sindicais e validação.
- `/rotas` e `/rotas/[id]`: criar, atribuir, ordenar, calcular, monitorar e publicar.
- `/visitas`: recebimentos e histórico; garantir escopo do usuário.
- `/validacoes`: evidência, respostas, aprovação/rejeição, auditoria e exclusão segura da foto.
- `/reembolsos`: lançar, enviar, avaliar e visualizar conforme papel.
- `/mapa`: cobertura, filtros e performance no celular.
- `/localizacoes`: agentes em campo e atualização de GPS, privacidade, sinal de última leitura.
- `/equipes`: convites, aprovação, papéis e status.
- `/relatorios`: métricas precisas, filtros e exportação, conforme autorização.
- `/importacoes`: importações validadas, CSV e registros duplicados.
- `/configuracoes`: perfil, preferências e configurações permitidas.
- `/limpeza`: apenas admin, com pré-visualização de escopo e confirmação.
- `/agente`: início do dia.
- `/campo/[id]`: navegação guiada responsiva, foto, perguntas, confirmação e próxima visita.

Não confundir página renderizada/CI verde com funcionalidade real testada: realizar teste por fluxo em Preview e com cada papel autorizado.

## 5. Identidade visual definitiva aprovada

**Referência mandatória de login:** fotografia do petshop com funcionários, cães e gato, formulário funcional por cima da foto, inputs brancos, botão **laranja** e base **preta**. Links de criar conta/esqueci senha e assinatura ficam na parte inferior. As imagens que o usuário enviou são **referências da identidade**, não screenshots para usar inteiras como fundo. Não criar uma estética diferente com painel verde/creme para autenticação sem aprovação.

**Assets locais disponíveis nesta conversa:** `photo-login-desktop.webp`, `photo-login-mobile.webp`, derivados da foto limpa, além de `login_sindpetshop_sp_com_pets.png` como referência alternativa. Manter a imagem **sem texto ou formulário embutido**, para que os campos sejam HTML e responsivos. Evitar depender de URL de terceiros; preferir arquivo local versionado.

**UI interna**: simplificação progressiva, linguagem visual SindPetshop-SP (laranja, preto, textos legíveis), contraste, hierarquia forte, acabamento de apps iOS modernos, sombras discretas e dock inferior adaptável ao papel. A navegação **principal** no mobile usa no máximo 4 destinos + Mais; as opções secundárias ficam no painel Mais. No desktop, a navegação pode ser contextual, sem desperdiçar espaço.

**Acessibilidade**: alvo de toque ≥44px (ideal ≥48px para público idoso), corpo mínimo 14–16px, foco visível, labels persistentes, avisos `role=status/alert`, teclado e leitura de tela, movimento reduzido, área segura no iPhone, não depender só de arrastar.

**Mobile mapa**: mapa full screen, cabeçalho discreto, próxima instrução e empresa, CTA principal (Cheguei). Máximo de dois botões flutuantes para GPS e Mais; nenhuma barra cobrindo CTA. Evitar repetição da mesma informação em três locais. O formulário de visita fica em etapa dedicada de tela cheia.

## 6. Arquitetura e infraestrutura conhecidas

- Repositório GitHub: `Seeven777/Gest-o-de-Campo-Sind`.
- Hospedagem: Vercel, projeto `gest-o-de-campo-sind`; produção é protegida, publicar mudanças em Preview primeiro.
- Banco: Neon Postgres, projeto `seeven-mkt` (Neon Auth integrado).
- Stack: Next.js App Router 16, React 19, TypeScript, Neon Auth, Neon serverless Postgres, Leaflet/OSM, OpenRouteService, Vercel Blob para evidências.
- Credenciais somente em ambientes seguros; jamais expor `DATABASE_URL`, chaves de roteamento ou secrets no cliente ou repositório.
- Arquivos de referência: `lib/access.ts`, `lib/api.ts`, `lib/auth/*`, `lib/menu.ts`, `components/portal.tsx`, `components/role-dock.tsx`, `components/field-navigation-map.tsx`, `app/campo/[id]/page.tsx`, `app/campo/jornada.css`, `app/auth.css`, `app/dock.css`.
- Variáveis usuais: `DATABASE_URL`, `DATABASE_NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `OPENROUTESERVICE_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` conforme implementação. Nunca versionar valores.
- CI: GitHub Actions em `.github/workflows/jornada-checks.yml`; executar `npm run typecheck`, `npm run lint`, `npm run build` e testes funcionais. O CI existente deve ser corrigido para não reescrever lockfile/branch inadvertidamente.
- **Não executar migração/limpeza em produção** durante redesign e auditoria sem autorização do usuário.

## 7. Histórico de problemas e riscos

- Recuperação de senha apresentou 404 e erro `Invalid redirectURL`, foi tratado em fluxos posteriores; revalidar configuração Neon Auth.
- Login mostrou erro credencial enquanto havia usuário no Better Auth sem senha; distinguir verificação de e-mail, perfil administrativo e conta com password.
- Conta de usuário aprovada permaneceu na tela de espera por erro de redirecionamento, corrigido anteriormente; revalidar.
- Lista de validação recusava usuário pendente com e-mail ainda não verificado; comportamento intencional no backend.
- Roteamento falhou por empresas sem coordenadas, depois por quota/erro OpenRouteService; não esconder avisos úteis e não mentir sobre ETA.
- Confirmação de chegada carregava lentamente; foi otimizada reutilizando GPS fresco e evitando GET redundante.
- Mapa mobile ficou poluído; versão posterior simplificou a navegação.
- Interface de login recém-integrada apontava `/sind-login-desktop.webp` e `/sind-login-mobile.webp` **ausentes no repositório**; foto não aparecia. Corrigir com assets locais e composição responsiva.
- Dock inferior pode apontar para telas/ações fora das permissões e pode disputar espaço com mapas/teclado; revisar perfil a perfil.
- Barra superior contém ícone de notificações não implementado; evitar controles inertes.
- Permissão de Marketing ainda não existe em `lib/access.ts`.
- Fotos de fachada exigem armazenamento privado, validação de dono/rota, retenção curta e política explícita.
- Monitoramento de GPS deve mostrar última posição, precisão, atualização e condições de privacidade, sem prometer rastreio em background de navegador fechado.

## 8. Critérios de aceitação e forma de trabalhar

1. Ler este documento quando chamado `MODO ROTEIRIZADOR`, mas verificar código e serviços atuais.
2. Auditar as telas uma a uma, incluindo estados vazios, erro, carregamento, acessibilidade, role e mobile/desktop.
3. Corrigir bug existente antes de acrescentar efeito visual. Não mudar a identidade aprovada.
4. Implementar preferencialmente em branch e PR; passar lint/TypeScript/build; abrir Preview com Neon **isolado** e testar os fluxos possíveis.
5. Diferenciar resultado **validado por CI**, **validado em Preview** e **ainda dependente de teste manual real (GPS/câmera/conta por papel)**.
6. Explicitar limites: sem tráfego em tempo real, navegação offline, push/voz nativa ou acompanhamento GPS com browser fechado se não implementados.
7. Guardar lista de pendências verificáveis, sem afirmar que “tudo funciona” só porque o build passou.
8. Após aprovação do usuário, fazer merge e acompanhar deploy de produção.
9. Só depois finalizar limpeza dos dados de teste e planejar integração da base externa/ngrok.

## 9. Prioridades atuais (11/11/2026)

P0: corrigir o login visual sem fotografia; login/cadastro/recuperação e autorização; dock de permissão; rotas e CTA no mobile; erros de API.
P1: revisar páginas e dados reais, estados vazios, filtros, formulários, central de validação, GPS, armazenamento e logs.
P2: testes automatizados (funcionais e regras de papel), otimização de desempenho e acessibilidade.
P3: limpeza autorizada de dados de teste; somente depois integração externa com a base principal de empresas.

## 10. Atualização técnica posterior à auditoria (11/11/2026)

- Correções adicionais no PR #18: smoke HTTP sem falso 404 do Next RSC, proteção de rotas ainda não publicadas contra acesso direto por agente, GPS nulo rejeitado no servidor, campanhas/despesas ligadas somente a rotas atribuídas publicadas, correção de grid mobile em Campanhas e tratamento de sessão ausente em Visitas.
- A execução CI `43056342215` da branch de auditoria foi concluída com sucesso; homologação autenticada e uso do celular continuam pendentes.
- Para novas alterações, preservar os controles de identidade sem depender de imagens de captura de tela, retestar banco Neon isolado e evitar alterar a produção sem homologação.
