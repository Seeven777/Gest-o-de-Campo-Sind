# SindPetshop-SP — Cadastro aberto, acesso sujeito à aprovação (v0.4)

## Instalação

1. Faça backup do repositório e trabalhe numa branch.
2. Copie os arquivos deste pacote para os caminhos correspondentes na raiz do repositório.
3. Execute `neon/003_access_requests.sql` no SQL Editor **na branch do Neon que a aplicação utiliza**; em produção, branch `main`.
4. Faça o deploy de **Preview** na Vercel; a variável `DATABASE_URL` deve apontar para a branch que recebeu a migração.
5. Teste conta nova usando e-mail verificável, cadastro, solicitação pendente, aprovação pelo administrador e entrada após aprovação.
6. Verifique que o usuário pendente não consegue consultar `/api/companies`, `/api/campaigns` ou `/api/overview`.

## Fluxo

- A tela `/login` oferece **Criar conta**.
- Nome, e-mail e senha são enviados para o Neon Auth, **não** para as tabelas de aplicação.
- A solicitação é criada em `access_requests` mediante sessão autenticada; o e-mail da solicitação é obtido da sessão no servidor, nunca confiado ao corpo da requisição.
- Se a conta necessitar confirmar e-mail, a pessoa deve primeiro realizar essa confirmação pelo Neon Auth e entrar novamente.
- A tela `/aguardando` mostra o estado sem expor dados internos.
- `/equipes` permite ao administrador aprovar ou recusar. O papel é escolhido **apenas pelo administrador**.
- Ao aprovar, `app_profiles` é criado/ativado em uma única operação SQL atômica.
- Por segurança, aprovar requer `neon_auth."user"."emailVerified" = true`; o cadastro de conta, por si só, não garante posse do e-mail.

## Atenção

O Neon Auth pode permitir cadastro público no serviço de identidades. **Isso não concede acesso à plataforma.** Todas as APIs do projeto devem sempre checar `currentIdentity` ou `withRole`.

Não altere `emailVerified` nem senhas diretamente via SQL. Configure o envio oficial de verificação de e-mail no Neon Auth antes de abrir o cadastro para outros colaboradores.

Se você já aplicou o pacote v0.3 baseado em convites, desative/remova os endpoints `/api/access-invitations` e `/api/access-invitations/redeem` e a página `/convite`. Caso contrário, o fluxo antigo de convites continuaria como meio alternativo de ativação.

O pacote contém apenas arquivos novos e modificados. Não elimina contas existentes, inclusive o administrador já aprovado.
