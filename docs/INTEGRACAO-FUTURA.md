# Integração futura — Busca de CNPJs → Gestão de Campo

Este aplicativo mantém a sua própria base de estabelecimentos. A ferramenta de pesquisa de empresas poderá alimentar o módulo de importação por um **serviço autenticado de ingestão**, a ser implementado posteriormente.

Contrato proposto (não está ativo):

```json
{
  "cnpj": "00000000000000",
  "razao_social": "Nome empresarial",
  "nome_fantasia": "Nome fantasia",
  "logradouro": "Rua Exemplo",
  "numero": "10",
  "bairro": "Centro",
  "municipio": "São Paulo",
  "uf": "SP",
  "cep": "01000000",
  "cnae": "4789004",
  "fonte": "dados_publicos_receita",
  "coletado_em": "2026-11-10T12:00:00Z"
}
```

O CNPJ deve ser validado por dígitos verificadores. O servidor precisa autenticar cada lote recebido, impor limites de tamanho e consumo, registrar a fonte e operar com deduplicação por CNPJ. A existência na Receita não equivale a validação física da operação.
