# Plano — tool-registry (microsserviço nº 5 da spec)

**Status:** ✅ Concluído (verificado ao vivo) · **Atualizado:** 2026-06-27

> Entregue: `tool-registry` (8084, Eureka) com `calculator`/`datetime`/`db_query`; `agent-service`
> usa `ToolRegistryClient` (`lb://` + breaker `toolRegistry` + fallback). Verificado: `/chat` usa
> calculator (→60) e db_query (→"14 eventos") remotos; db_query rejeita não-SELECT; breaker degrada.
> `datetime` executa mas o llama3.1 às vezes ignora a observação (limitação do modelo). ADR 0011.

## Objetivo

Extrair as ferramentas do agente para um microsserviço **`tool-registry`** (Spring Boot, Eureka
client), como pede a spec (serviço nº 5: "Registra e expõe ferramentas que os agentes podem
invocar — calculadora, consulta a base de dados"). Hoje o `ToolRegistry` é **in-process** no
`agent-service`. Além de fechar o 7º serviço da arquitetura, destrava um **conjunto maior de
ferramentas** (o agente parece "cru" com só a calculadora).

**Pronto** = (1) `tool-registry` `UP` no Eureka expõe `GET /tools` (specs) e `POST /tools/{name}:execute`;
(2) o `agent-service` resolve `lb://tool-registry`, busca as specs e delega a execução (com circuit
breaker + fallback: registry fora → agente responde sem ferramentas); (3) ≥3 ferramentas reais
(calculator, datetime, db_query); (4) ciclo agêntico continua funcionando ponta-a-ponta; (5) builds verdes.

## Escopo

- **Inclui:**
  - Módulo Maven novo **`tool-registry/`** (porta **8084**, pacote `com.tes2.toolregistry`): Spring Web,
    validation, actuator, Eureka client. Coleta beans `Tool` locais e os expõe por REST.
  - **Ferramentas** no registry: `calculator` (movida do agent-service, com `ExpressionParser`),
    `datetime` (data/hora atual, ISO), `db_query` (consulta **read-only** ao Postgres — exemplo literal
    da spec; allowlist de SELECT, sem DDL/DML).
  - **agent-service:** substituir o `ToolRegistry` in-process por um **`ToolRegistryClient`**
    (`lb://tool-registry`, RestClient load-balanced + circuit breaker `toolRegistry`, fallback = sem
    ferramentas). `AgentLoop` busca as specs do registry e delega `execute` a ele. Manter o gating
    (só oferecer ferramentas conforme a mensagem).
  - Rota opcional no `api-gateway` p/ inspeção (`/tools/**` → `lb://tool-registry`), só leitura.
  - Docs: `architecture.md` (status do serviço 5), `runbook.md`, `plan/README.md`, ADR 0011.
- **Não inclui:**
  - Registro **dinâmico** de ferramentas em runtime (plugins, upload) → evolução futura; aqui as
    ferramentas são beans compilados no `tool-registry`.
  - Ferramentas com efeitos colaterais perigosos (escrita em DB, shell, etc.). `db_query` é read-only.
  - Auth entre serviços → fora do escopo (rede interna).

## Decisões de design

### Contrato REST do registry — **specs + execução remota**

- `GET /tools` → `[{ name, description, parameters }]` no mesmo formato de `ToolSpec` (function schema
  OpenAI), pronto p/ o `agent-service` repassar ao LLM.
- `POST /tools/{name}:execute` body `{ "arguments": "<json string>" }` → `{ "result": "<texto>" }`.
  O `arguments` é a string JSON que o LLM produz (igual ao que o loop já passa hoje).
- Erros de execução viram `result` com mensagem de erro (não 5xx) — o agente observa e segue, como hoje.

### Resiliência — **breaker `toolRegistry`, fallback = sem ferramentas**

- `agent-service` envolve `getTools()` e `execute()` no `CircuitBreakerFactory` (mesma API programática;
  ADR 0005). Registry fora: `getTools()` → lista vazia (agente responde sem ferramentas), `execute()` →
  observação "ferramenta indisponível". O `/chat` nunca quebra. Time limiter curto (3s).

### `db_query` seguro — **somente SELECT, allowlist**

- Aceita apenas `SELECT ...` (regex + rejeita `;`, `--`, DDL/DML). Conecta no Postgres da Entrega 3
  (read-only). Exemplo de ferramenta "consulta a base de dados" da spec, sem risco de escrita.

### Onde a calculadora mora — **movida para o registry**

- `CalculatorTool` + `ExpressionParser` saem do `agent-service` e vão para o `tool-registry`. O
  `agent-service` deixa de ter ferramentas locais (vira puro orquestrador). O contrato `Tool`/`ToolSpec`
  é replicado no registry (ou extraído; por ora replicado p/ manter os serviços desacoplados).

## Tarefas

| # | Tarefa | Subagent | Arquivos | Depende de |
|---|--------|----------|----------|------------|
| 1 | Confirmar (Context7): `spring-boot-starter-jdbc`/`JdbcTemplate` p/ `db_query` read-only no BOM 3.5.9; padrão de `RestClient` load-balanced (já usado). | `context7` | — | — |
| 2 | **Scaffold** `tool-registry`: `pom.xml`, `ToolRegistryApplication`, `application.yaml` (8084, Eureka, datasource read-only opcional), wrapper mvnw. | `general-purpose` | `tool-registry/...` | 1 |
| 3 | **Tools no registry:** interface `Tool` + `ToolSpec`; `CalculatorTool`(+`ExpressionParser`), `DateTimeTool`, `DbQueryTool`; `ToolRegistry` (coleta beans); `ToolController` (`GET /tools`, `POST /tools/{name}:execute`). | `general-purpose` | `tool-registry/.../{tools,web}/*` | 2 |
| 4 | **agent-service refactor:** `ToolRegistryClient` (lb:// + breaker + fallback); `AgentLoop` usa specs/execute remotos; remover `CalculatorTool`/`ExpressionParser`/`ToolRegistry` locais (ou manter como fallback?); `RestClientConfig`/`ResilienceConfig`/`application.yaml`. | `general-purpose` | `agent-service/.../tools/*`, `.../agent/AgentLoop.java`, config | 3 |
| 5 | **api-gateway:** rota `/tools/**` → `lb://tool-registry` (inspeção). | `cavecrew-builder` | `api-gateway/.../GatewayRoutesConfig.java` | 3 |
| 6 | **Docs + ADR 0011** (tool-registry remoto; contrato; db_query seguro). | `cavecrew-builder` | `docs/...` | 2–5 |
| 7 | **Integração e verificação:** subir registry; `GET /tools`; `/chat` com calc + datetime + db_query; breaker (registry fora). | thread principal | — | 2–6 |

## Critérios de aceite

- [ ] `TOOL-REGISTRY` `UP` no Eureka; `GET /tools` lista ≥3 ferramentas; `POST /tools/calculator:execute` avalia.
- [ ] `/chat` "quanto é (12+8)*3" usa o calculator **remoto** → 60.
- [ ] `/chat` que peça data/hora usa `datetime`; pergunta que precise de dado do banco usa `db_query` (SELECT).
- [ ] Registry fora → `/chat` responde sem ferramentas (fallback), sem 5xx.
- [ ] `db_query` rejeita não-SELECT.
- [ ] Builds verdes (`mvn package` agent-service, tool-registry).

## Riscos

- **R1 — duplicação do contrato `Tool`/`ToolSpec`** entre serviços. Aceito (serviços desacoplados); evolução = módulo compartilhado.
- **R2 — `db_query` injection.** Mitigado: allowlist SELECT, sem `;`/comentários, read-only.
- **R3 — latência extra** (hop ao registry por execução). Aceito; breaker curto. Specs podem ser cacheadas.
- **R4 — gating de ferramenta** continua no agent-service (decide quais specs advertir).
