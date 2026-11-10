# Limpeza de registros de teste (v1.0)

Esta funcionalidade é **exclusiva para administradores aprovados e ativos**. A página `/limpeza` permite localizar um item, inspecionar vínculos e excluí-lo individualmente após digitar `EXCLUIR <nome exato>`.

## Instalação

1. Faça backup ou crie um branch do banco no Neon.
2. No SQL Editor, execute `neon/005_limpeza_segura.sql` antes de testar os botões. Esse script **apenas cria uma função** e não apaga nada automaticamente.
3. Configure o Preview da Vercel preferencialmente com banco Neon isolado. Uma branch de código da Vercel pode compartilhar o mesmo `DATABASE_URL` de produção — não pressuponha isolamento.
4. Teste com um registro descartável criado especificamente para isso; verifique a auditoria em `audit_logs`.
5. Somente após validar as regras de segurança, considere publicar o PR.

## Restrições

- Rotas: somente se a campanha tiver `teste` no nome; a exclusão apaga visitas e evidências vinculadas, mas **não** remove as empresas da base.
- Visitas: somente se pertencentes a uma campanha de teste; remove suas evidências.
- Despesas: somente despesas não pagas de campanhas de teste.
- Campanhas: somente campanhas de teste e apenas quando não possuem rotas/despesas.
- Empresas: somente quando não há vínculo com rotas, nem cadastro sindical confirmado. CNPJs não são excluídos automaticamente em lote.
- Cada exclusão é atômica pela função no banco e gera um registro em `audit_logs`.
- Nenhum dado é apagado pela mera execução da migração ou pela abertura da tela.
- Não há exclusão de usuários ou de toda a base em lote. Isso exige fluxo de retenção e auditoria próprio.

## Ordem para limpar um experimento completo

1. Excluir rotas de teste (que limpam visitas e evidências).
2. Excluir despesas de teste não pagas.
3. Excluir campanhas de teste vazias.
4. Pesquisar empresas individualmente e excluir somente as que não possuem vínculos e não são cadastros confirmados.

**Limitação:** se uma visita de teste já tiver alterado `establishments.field_status`, a exclusão da visita não reverte automaticamente esse valor. Revise esse status separadamente antes de utilizar os indicadores. Arquivos já enviados a armazenamento externo também exigiriam fluxo de exclusão no storage; a função apaga somente referências no PostgreSQL.

## Segurança de dados

Quando o banco começar a conter dados reais, substitua a exclusão física por arquivamento/retencão definida pelo sindicato, sobretudo para histórico de visita, comprovantes e cadastro sindical. Não vincule esta funcionalidade a perfis Marketing, Supervisor ou Agente.
