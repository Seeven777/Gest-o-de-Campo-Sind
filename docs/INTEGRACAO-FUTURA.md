# Contrato para integração futura com o buscador de empresas

O sistema de pesquisa de CNPJs permanecerá independente da Gestão de Campo.

## Fluxo proposto

1. Buscador descobre estabelecimentos com CNAEs de interesse.
2. Exporta um lote JSON ou CSV padronizado.
3. Gestão de Campo recebe o lote por importação administrativa (atual) ou endpoint autenticado (futuro).
4. Valida CNPJ completo, preserva origem/coleta e faz deduplicação.
5. Estabelecimentos novos entram em `pending`, nunca como visitados/cadastrados.

## Payload futuro sugerido

```json
{
  "source": "buscador-cnpj",
  "source_batch_id": "uuid-na-origem",
  "records": [{
    "cnpj": "00000000000000",
    "legal_name": "Empresa exemplo",
    "trade_name": "Nome fantasia",
    "main_cnae": "4789004",
    "street": "Rua Exemplo",
    "number": "123",
    "district": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "postal_code": "01000000"
  }]
}
```

O CNPJ demonstrativo é inválido; substitua por dado legítimo para importação. A API futura deverá exigir credencial servidor-a-servidor, idempotência por origem/lote e paginação/limite de requisições. Nunca publique token de integração no navegador.

Manter `external_source_id`, data de atualização e trilha de auditoria ao implementar a sincronização bidirecional. Mudanças de fonte não devem sobrescrever status de visita ou confirmação cadastral.
