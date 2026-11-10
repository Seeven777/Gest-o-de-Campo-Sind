# Integração entre Pet_dados e SindPetshop-SP
Esta versão **não acessa** diretamente o banco da ferramenta externa e **não realiza captura em massa**. Os 1.848 registros históricos permanecem intactos.
A conexão é por API HTTP(S) configurada **no servidor**, por `COMPANY_CATALOG_ENDPOINT` (URL completa do endpoint de busca) e, opcionalmente, `COMPANY_CATALOG_API_KEY`.
Não coloque chaves no navegador ou em variáveis `NEXT_PUBLIC_*`.
O projeto Pet_dados ainda precisa disponibilizar uma rota autenticada que aceite os parâmetros `cnae`, `city`, `state`, `type`, `q`, `page`, `limit`.
Exemplo da resposta esperada:
```json
{"items":[{"cnpj":"00000000000191","razao_social":"Empresa exemplo","nome_fantasia":"","municipio":"São Paulo","uf":"SP","cnae":"7500100","logradouro":"Rua exemplo","numero":"10","bairro":"Centro","cep":"01001000","porte":"ME"}],"total":1}
```
Os CNPJs acima são ilustrativos, não devem ser importados em produção. O normalizador aceita alternativas de nomes de campos e valida dígitos verificadores.
GET /api/catalogo: filtra na fonte externa e marca CNPJs que já existem na operação.
POST /api/catalogo: inclui **somente** as empresas selecionadas no banco de campo, sem sobrescrever as existentes. Permissões admin/supervisor.
A fonte é configurada por URL fixa de ambiente (não fornecida pelo navegador); usa HTTPS, tempo limite, sem redirecionamentos e máximo de 50 empresas por solicitação.
**Importante:** a ferramenta de pesquisa externa ainda não teve sua API verificada. O endpoint deve ser adaptado ao esquema real e testado com credenciais de Preview antes de produção.
