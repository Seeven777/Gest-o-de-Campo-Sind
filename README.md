# SindPetshop-SP — Gestão de Campo

Starter da primeira etapa do MVP: navegação administrativa e do agente, login por Supabase Auth, consulta/importação CSV e criação de campanhas. Os demais módulos estão identificados na interface, mas ainda não possuem fluxo operacional real.

## Pré-requisitos

- Node.js 22 ou superior.
- Projeto Supabase configurado.
- Projeto Vercel para deploy.

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env.local`.

Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com valores públicos do seu projeto. **Não** configure chaves secretas com prefixo `NEXT_PUBLIC_`.

Sem configurar variáveis de ambiente, a interface abre em **modo de demonstração**, sem operações persistentes.

## Banco de dados

1. Crie um projeto Supabase novo.
2. Execute `supabase/migrations/0001_foundation.sql` no SQL Editor após revisar as políticas.
3. Na configuração Data API do projeto, habilite o acesso às tabelas necessárias. Em projetos Supabase recentes, tabelas novas não são necessariamente expostas automaticamente; verifique também `GRANT SELECT/INSERT/UPDATE` para `authenticated` nas tabelas que a UI acessará. Mantenha RLS ativo.
4. Crie o primeiro usuário em Authentication > Users.
5. Associe sua conta a um perfil `admin` conforme comentário no final do SQL.
6. Reinicie o servidor após configurar `.env.local`.

**Atenção:** não execute o SQL de produção sem revisar o modelo de autorização, especialmente ao ampliar os módulos. O script é uma base de desenvolvimento, não um certificado de segurança.

## Importação

Acesse `/importacoes` e envie CSV com cabeçalhos `cnpj,razao_social,nome_fantasia,logradouro,numero,bairro,municipio,uf,cep,cnae`.

A importação é feita em lotes de 100 via sessão autenticada e RLS. CNPJs repetidos são atualizados (`upsert`), preservando seu ID. Em caso de interrupção, o histórico de lotes pode ficar parcial e deve ser reconciliado antes de reprocessar. Não há ainda geocodificação automática.

## Deploy Vercel

1. Envie esta pasta para um repositório GitHub.
2. Importe o repositório na Vercel como Next.js.
3. Configure as duas variáveis `NEXT_PUBLIC_...` no projeto Vercel.
4. Faça deploy após configurar banco, perfis e políticas de acesso.

## Segurança e limitações conhecidas

- Somente o módulo inicial de empresas/importação/campanhas possui integração real com o banco.
- Não existe ainda motor de rotas, coleta de localização, fotos ou fluxo de reembolso.
- RLS está habilitado; papéis de acesso e buckets de evidências ainda precisam de revisão e teste de políticas antes de implantação real.
- Dashboard apresenta contagens simples de registros, não métricas consolidadas de validação.
- Gestão de empresas carrega apenas os 500 registros mais recentes (paginação futura).
- Suporte XLSX, geocodificação, integração com buscador de CNPJ e processamento assíncrono de grandes importações ficam para etapas posteriores.
- Dependências estão declaradas, mas o lockfile deve ser gerado com `npm install` e commitado antes de publicar.

Veja `docs/INTEGRACAO-FUTURA.md` para o contrato proposto com o buscador de CNPJs.
