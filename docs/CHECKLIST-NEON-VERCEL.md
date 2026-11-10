# Checklist Neon / Vercel

O sistema atual usa Neon PostgreSQL e Neon Auth. O projeto Vercel precisa das variáveis:

- `DATABASE_URL` — fornecida automaticamente pela integração Neon;
- `DATABASE_NEON_AUTH_BASE_URL` — fornecida automaticamente pela integração Neon Auth;
- `NEON_AUTH_COOKIE_SECRET` — secret aleatório seguro, definido apenas no servidor, para proteger cookies de sessão.

Os ambientes Production e Preview devem ser configurados de forma consistente; **não** publique o valor de segredos no GitHub.

## Diagnóstico

Se o build falhar em `Failed to collect page data for /api/imports` com `Missing required config: cookies.secret`, verifique a presença de `NEON_AUTH_COOKIE_SECRET` e inicie um novo deployment após adicionar a variável.

Se o TypeScript falhar em `lib/supabase.ts`, remova o código legado do Supabase (não reinstale `@supabase/supabase-js` como paliativo).

## Próximas verificações

1. Confirmar que a branch Preview gera build;
2. Verificar login e sessão do Neon Auth;
3. Executar o SQL de inicialização em Neon no ambiente adequado;
4. Testar permissões de administrador e agente;
5. Validar o fluxo de importação de CNPJ com dados de teste.

O sucesso do build não confirma que o banco já recebeu as tabelas necessárias.
