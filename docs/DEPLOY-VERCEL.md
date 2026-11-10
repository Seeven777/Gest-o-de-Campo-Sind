# Deploy na Vercel — SindPetshop-SP Gestão de Campo

## 1. Importar repositório

Na Vercel, use **Add New → Project → Import Git Repository** e selecione `Seeven777/Gest-o-de-Campo-Sind`.

Configurações:
- Framework Preset: **Next.js**
- Root Directory: **./** (raiz)
- Build Command: **npm run build**
- Install Command: **npm install**
- Output Directory: **padrão do Next.js** (não configure `dist` ou `out`)
- Node.js: **22.x**
- Production Branch: **main**

Não habilite `output: 'export'` no Next.js: a autenticação e integrações futuras precisam de execução dinâmica.

## 2. Variáveis de ambiente

Em **Project Settings → Environment Variables**, configure:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

São credenciais públicas de cliente, *não* chaves secretas. Não coloque `service_role`, chaves `sb_secret_...` ou tokens administrativos em variáveis `NEXT_PUBLIC_`.

Marque os ambientes Production e Preview conforme desejado. Após adicionar/alterar variáveis, faça novo deployment.

## 3. Preparar o Supabase

1. Crie o projeto Supabase.
2. Revise e aplique `supabase/migrations/0001_foundation.sql` via SQL Editor (uma vez, em ambiente autorizado).
3. Verifique RLS, concessões para `authenticated` e exposição das tabelas na Data API.
4. Crie usuário em Authentication e associe seu perfil de administrador.
5. Teste login, importação e campanhas em Preview antes da publicação.

Sem variáveis, a interface inicia em modo demonstração. Isso **não** significa que o banco, autenticação ou gravação estão operacionais.

## 4. Verificação pós-deploy

- Abra `/login` e confirme a autenticação.
- Abra `/dashboard`, `/empresas`, `/importacoes`, `/campanhas`.
- Importe uma pequena planilha de teste com CNPJ não real ou dados autorizados.
- Confirme a criação no banco e a restrição de acesso com outra conta.
- Consulte logs de Build e Functions na Vercel se houver erro.

## 5. Erros frequentes

| Erro | Ação |
| --- | --- |
| `NEXT_NOT_FOUND` | Confirme Root Directory `./` e preset Next.js. |
| `npm ERR!` durante instalação | Confira dependências e gere/commite `package-lock.json` com `npm install` em Node 22. |
| Variáveis ausentes | Cadastre ambas as variáveis e redeploy. |
| Login falha | Confira usuários, Supabase Auth e URL/keys. |
| `permission denied` / RLS | Confira políticas e grants no banco; não desabilite RLS como atalho. |

## 6. Atenção ao lockfile

O repositório inicial não inclui `package-lock.json`. Para builds reproduzíveis, rode na raiz com Node 22:

```bash
npm install
npm run typecheck
npm run build
git add package-lock.json
git commit -m "chore: lock npm dependencies"
git push
```

Depois do lockfile, configure o comando de instalação na Vercel para `npm ci`, se desejar verificação estrita.

Este projeto é um MVP inicial. Roteirização, GPS, fotos e reembolso não estão prontos para uso real.
