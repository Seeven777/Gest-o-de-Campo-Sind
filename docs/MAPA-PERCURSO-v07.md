# Percurso inteligente v0.7 — SindPetshop-SP

## Objetivo
Substituir os links externos na tela `/rotas/[id]` por mapa interativo com paradas numeradas, ruas do trajeto e ordem de visita sugerida.

## Integração de mapas
- Mapa: Leaflet 1.9.4 (CDN), base OpenStreetMap com atribuição visível. Para escala de produção, verificar política de uso de tiles e planejar provedor de mapas próprio/comercial.
- Roteirização e geocodificação: **openrouteservice** API (ORS), opção sem dependência do ngrok.
- O cálculo utiliza ORS Optimization/VROOM para sequenciamento e ORS Directions para desenhar a rota pelas vias, com distância e duração estimadas.
- A ordem é **aproximada**, não globalmente ótima; não inclui trânsito em tempo real, duração das visitas, pausas ou restrições de janelas de atendimento.
- Por padrão, começa na primeira empresa da rota. Caso o agente opte por "Usar minha localização como início", o navegador solicita permissão GPS uma única vez e passa o ponto à API. Não há monitoramento contínuo nem gravação do ponto inicial.
- As coordenadas das empresas são obtidas do campo `establishments.position`. Se ausentes, a API tenta geocodificar no máximo **8 novos endereços por execução**, armazenando as coordenadas encontradas para reutilização.
- A geocodificação pode apontar endereço aproximado ou incorreto. Antes de trabalho de campo real, conferência no mapa é obrigatória.

## Configuração na Vercel
1. Crie uma chave em https://openrouteservice.org/dev/#/signup.
2. Em Vercel > Project > Settings > Environment Variables, adicione `OPENROUTESERVICE_API_KEY` como variável **sensitive** no ambiente de Preview, nunca como `NEXT_PUBLIC_*`.
3. Faça redeploy do Preview.
4. Acesse Rotas, crie uma rota com 2–4 empresas com endereços completos e entre em "Ver percurso".
5. Clique em "Calcular melhor trajeto". Verifique pinos, ruas, ordem e estimativas. Teste uma vez com o GPS opcional.

## Limites
- Dependência de serviço de terceiros e cotas gratuitas/planos da ORS; sem chave o botão exibe orientação em vez de inventar uma rota.
- O backend faz até 8 tentativas de geocodificação por execução e retorna os nomes não localizados para revisão. Repetir após correção de endereço ou para geocodificar lote adicional.
- Não alterar ordem original `route_stops.position_order` automaticamente: a ordenação sugerida é **temporária na visualização** até que o supervisor valide uma função futura de salvar/publicar sequência.
- Dados GPS e endereços são disponibilizados somente a usuários autenticados; agentes só acessam suas próprias rotas publicadas.
- O mapa deve ser testado em celular real, incluindo GPS, zoom, estabilidade, exatidão e respeito aos limites da API.
- Esta alteração não modifica o banco de empresas, a integração ngrok ou os cadastros definitivos.
