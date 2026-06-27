# ADR 0011 — tool-registry como microsserviço remoto; ferramentas fora do agent-service

**Status:** Aceito · **Data:** 2026-06-27

## Contexto

A spec lista o `tool-registry` como microsserviço nº 5 ("Registra e expõe ferramentas que os
agentes podem invocar — calculadora, consulta a base de dados"). Até aqui o `agent-service` tinha
as ferramentas **in-process** (`ToolRegistry` coletando beans `Tool`). Além de fechar o 7º serviço
da arquitetura, um conjunto maior de ferramentas tornava o agente menos "cru".

## Decisão

- **Novo serviço `tool-registry`** (Spring Boot, porta 8084, Eureka client). Coleta beans `Tool`
  locais e os expõe por REST:
  - `GET /tools` → `List<ToolSpec>` no formato OpenAI (pronto p/ o `agent-service` repassar ao LLM).
  - `POST /tools/{name}/execute` body `{ "arguments": "<json>" }` → `{ "result": "<texto>" }`.
    Erros de execução voltam em `result` (não 5xx) — o agente observa e segue.
- **Ferramentas:** `calculator` (movida do agent-service com `ExpressionParser`), `datetime`
  (data/hora ISO), `db_query` (SELECT read-only no Postgres da plataforma — exemplo literal da spec).
- **`agent-service` vira orquestrador puro:** removidas as classes de ferramenta locais; novo
  `ToolRegistryClient` (RestClient `lb://tool-registry`) busca specs e delega execução, com circuit
  breaker **`toolRegistry`** (time limiter 3s) e **fallback gracioso** — registry fora → specs vazias
  (responde sem ferramentas) / execução → "ferramenta indisponível". O `/chat` nunca quebra.
- **Gating de ferramenta no agent-service:** só advertimos as ferramentas ao LLM quando a mensagem
  tem dígito **ou** palavra-chave de data/dados (`needsTools`). Saudações/testes não recebem
  ferramentas — evita a alucinação de tool-call do modelo local (continuação do ADR 0009).
- **`db_query` seguro:** aceita só `SELECT`/`WITH`; rejeita `;`, comentários e qualquer DDL/DML;
  conexão Hikari `read-only`. Sem risco de escrita.
- **api-gateway:** rota `/tools/**` → `lb://tool-registry` (inspeção das specs).

## Consequências

**Prós**
- Fecha o microsserviço nº 5 da spec; ferramentas evoluem sem tocar no `agent-service`.
- Verificado ao vivo: `TOOL-REGISTRY` UP no Eureka; `/chat` usa `calculator` (→60) e `db_query`
  (→"14 eventos") via registry remoto; `db_query` rejeita não-SELECT; breaker degrada (registry fora →
  `/chat` ainda responde). Testes do `calculator` movidos para o `tool-registry`.

**Contras / trade-offs**
- **Contrato `Tool`/`ToolSpec` duplicado** entre `agent-service` e `tool-registry` (serviços
  desacoplados, sem módulo compartilhado). Evolução: módulo comum.
- **Latência extra** (hop ao registry por execução). Mitigado com breaker curto; specs poderiam ser cacheadas.
- **Registro estático:** ferramentas são beans compilados; registro dinâmico em runtime fica para depois.
- **Qualidade do modelo local:** o `datetime` executa e devolve a hora certa, mas o llama3.1 às vezes
  ignora a observação ("não tenho acesso a tempo real"). Limitação do modelo, não da infraestrutura;
  `calculator`/`db_query` ancoram corretamente.
