# SindPetshop-SP · Campo & Território

**Versão 0.2 — Redesign + migração inicial para Neon**

Central operacional responsiva criada em Next.js para a gestão territorial do SindPetshop-SP. Identidade visual proposta com fundos claros, laranja e verde; **o ícone é ilustrativo, não o logotipo oficial do sindicato**.

## Estado dos módulos

| Módulo | Estado |
| --- | --- |
| Autenticação Neon Auth | Implementação inicial; requer configuração e testes em conta real |
| Perfis de acesso (admin/supervisor/agent) | Validação no servidor via `app_profiles` |
| Dashboard | Consulta real de contagens ao Neon |
| Empresas | Busca paginada com restrição para agente |
| Importação CSV | Upload em lotes de até 100 CNPJs por requisição e atualização por CNPJ |
| Campanhas | Consulta e criação de campanhas em rascunho |
| Rotas, GPS, fotos, validação, reembolsos, mapa | Telas visuais / estrutura SQL; **operações ainda não implementadas** |

## Substituição dos arquivos no repositório

1. Faça backup/crie uma branch do repositório atual.
2. Extraia este ZIP na **raiz do repositório** `Seeven777/Gest-o-de-Campo-Sind`, substituindo arquivos iguais.
3. **Exclua o diretório antigo `supabase/` e o arquivo `lib/supabase.ts`, se presentes.** O ZIP já foi preparado sem eles; extrair por cima não os apaga automaticamente.
4. Confira o `git diff` e não envie arquivos `.env.local` nem credenciais.
5. Use Node 22, rode `npm install`, `npm run typecheck`, `npm run build` e **versione o `package-lock.json`** gerado.
6. Suba a branch para o GitHub e verifique o deploy Preview na Vercel antes de atualizar a produção.

### Configuração da Vercel

O projeto já recebe automaticamente da integração Neon:

- `DATABASE_URL`
- `DATABASE_NEON_AUTH_BASE_URL`

**Falta adicionar manualmente** uma variável **server-only** de sessão, presente nos ambientes Production e Preview:

```text
NEON_AUTH_COOKIE_SECRET=<valor aleatório de pelo menos 32 caracteres>
```

Gere localmente com `openssl rand -base64 48` (ou `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`). Cadastre diretamente em **Vercel → Settings → Environment Variables**. Não compartilhe o valor em conversas e não prefixe com `NEXT_PUBLIC_`.

A Vercel pode oferecer Node 26 por padrão; selecione **22.x** nas configurações de build se estiver disponível e teste com o mesmo Node localmente.

### Criar as tabelas

1. Na integração Vercel/Neon, escolha **Open in Neon** e abra o SQL Editor da branch `production`.
2. Revise e execute `neon/001_init.sql`.
3. Faça o mesmo na branch `preview`, **somente** se ela for um banco separado. Não copie dados reais para Preview sem análise de privacidade.
4. No Neon Auth, crie o usuário administrador por um fluxo de cadastro **controlado**, ou convide o usuário se o painel disponibilizar esse procedimento.
5. Localize o **ID do usuário de autenticação** no Neon Auth e execute no SQL Editor (substituindo valores):

```sql
insert into app_profiles(auth_user_id, full_name, role)
values ('ID_REAL_DO_USUARIO_NEON_AUTH', 'Administrador SindPetshop', 'admin');
```

Não existe concessão automática de acesso administrativo. Usuários sem linha em `app_profiles` recebem erro de autorização.

### Importação de empresas

Acesse `/importacoes` e carregue CSV com colunas `cnpj,razao_social,nome_fantasia,logradouro,numero,bairro,municipio,uf,cep,cnae`.

O arquivo é analisado primeiro no navegador; a API volta a validar CNPJ e campos no servidor. Os lotes são enviados sequencialmente. Se houver falha entre lotes, os anteriores permanecem gravados e podem ser reprocessados por CNPJ. **Não envie grandes volumes reais antes de testar em Preview.**

### Segurança

- Todas as consultas SQL acontecem no servidor. A string `DATABASE_URL` não vai ao navegador.
- Cada endpoint valida a sessão Neon Auth e consulta o papel autorizado em `app_profiles`.
- Administração e supervisão podem importar e criar campanhas; agentes consultam apenas empresas atribuídas a rotas próprias.
- Esta versão não disponibiliza coleta de fotos, GPS ou documentos; a escolha do storage privado e a política de retenção ficam para a implementação desses módulos.
- Antes de produção real, testar cenários de usuário sem perfil, agente, supervisor e administrador; revisar auditoria, rate limits, importação massiva e política de privacidade.

### Atenção

**O código foi preparado, mas não recebeu build completo neste ambiente:** o registry npm não estava acessível por DNS. As versões foram verificadas na documentação e no catálogo público, porém `npm install`, `typecheck`, `build` e testes de integração ainda são obrigatórios. Não considére a migração de autenticação validada até realizar login com Neon Auth e consultar dados reais.

## Documentação

- `docs/INTEGRACAO-FUTURA.md` — contrato futuro com o buscador de CNPJs.
- `neon/001_init.sql` — migração SQL inicial.
- `.env.example` — nomes de configuração necessários.

## Novidade — Gestão de convites (v0.3)

1. **Antes do deploy**, execute `neon/002_access_invitations.sql` no Neon SQL Editor no banco correto (e na branch Preview separadamente se aplicável).
2. Acesse `/equipes` com usuário que já possui `role='admin'` em `app_profiles`.
3. Preencha nome, e-mail e perfil; gere um convite de validade de 72h. O link aparece **uma vez** — copie e envie por um canal privado à pessoa convidada.
4. A pessoa abre `/convite?token=...`, cria sua conta (ou entra com conta existente) **usando o mesmo e-mail**. A API valida o token e a sessão antes de inserir o perfil. Caso a criação da conta exija confirmação de e-mail, conclua essa etapa e retorne ao link para entrar/ativar.
5. O administrador pode revogar convites ainda não usados. Tokens ficam armazenados somente como SHA-256. A equipe não recebe poderes de administrador por se cadastrar diretamente no Neon.

**Limites de segurança:** o Neon Auth gerenciado pode permitir cadastro público no nível do provedor. Isso **não** concede acesso às APIs internas, que verificam `app_profiles` do servidor. Para impedir também registros de identidade não convidados, é necessário configurar restrição no provedor de Auth quando suportada. O link deve ser compartilhado apenas com destinatários autorizados. Não se deve alterar papel/permissão no navegador nem usar SQL para criar senhas. Não há envio automático de convites por e-mail nesta versão.

### Arquivos novos/modificados da atualização

- `neon/002_access_invitations.sql` — tabela e índices
- `app/api/access-invitations/route.ts` — criar/listar/revogar (admin)
- `app/api/access-invitations/redeem/route.ts` — validar/aceitar (titular)
- `app/equipes/page.tsx` — interface administrativa
- `app/convite/page.tsx` — ativação do convidado

O pacote de atualização contém **somente esses arquivos**, preservando os arquivos existentes da versão 0.2/PR de recuperação de senha.
