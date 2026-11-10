# Recuperação de senha — SindPetshop-SP

Implementação:
- Tela de login oferece **Esqueci minha senha**.
- Ao solicitar recuperação, o cliente Neon Auth chama `requestPasswordReset` com redirecionamento para `/redefinir-senha`.
- A página recebe o token de uso único via link e chama `resetPassword` para definir a nova senha.
- Não há envio de senha por e-mail, escrita de hashes manualmente nem criação pública de contas nesta aplicação.

## Configuração necessária (Neon Auth)

O envio real depende das configurações do **Neon Auth / Better Auth** para e-mails de recuperação. Confirme que o provedor de e-mail está habilitado, que o domínio/URL de redirecionamento da Vercel está autorizado e que o ambiente de Preview aponta para o Auth correto.

O pedido de recuperação é tratado com mensagem genérica para evitar confirmar a existência de uma conta. Se não chegar e-mail, verifique o serviço de envio do Neon e os logs de autenticação. O código não fornece nem exibe tokens de recuperação.

## Teste

1. No ambiente Preview, abra `/login`.
2. Escolha **Esqueci minha senha** e informe o e-mail de um usuário de teste.
3. Verifique a entrega do e-mail.
4. Abra o link recebido; a página `/redefinir-senha` deve apresentar os campos de nova senha.
5. Defina uma senha com 12 ou mais caracteres.
6. Entre novamente pela tela `/login`.

**Atenção:** o usuário registrado no Neon que possui `neon_auth.account.password IS NULL` pode depender das regras do serviço gerenciado para utilizar a recuperação. Teste a entrega e a conclusão antes de considerar que uma senha foi criada.

Não altere `neon_auth.account.password` por SQL e não exponha `NEON_AUTH_COOKIE_SECRET` no navegador.
