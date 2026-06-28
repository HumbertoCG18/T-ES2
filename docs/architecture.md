# Arquitetura

> Entregável (a): diagrama de arquitetura documentando microsserviços, responsabilidades e
> protocolos de comunicação. Este arquivo é a fonte; exportar um diagrama visual (Excalidraw /
> draw.io / Mermaid) para o relatório e a apresentação.

## Visão geral

Plataforma de agentes de IA conversacionais. Um agente opera no ciclo
**raciocínio → ação → observação**: recebe a requisição, raciocina via LLM, invoca ferramentas,
observa o resultado e repete até a resposta final. Roda 100% local (sem nuvem) via Docker
Compose; alvo de produção é Kubernetes.

## Cliente (bônus, fora da spec)

`frontend/` — app web estilo claude.ai (Vite + React + Tailwind + shadcn). Consome `POST /chat`
via `api-gateway` (proxy de dev `/api` → `:8080`, com rewrite removendo `/api`). Não é exigido
pela spec; serve a teste e à demonstração. O "Cliente (HTTP)" do diagrama abaixo pode ser este
frontend, `curl` ou Postman.

## Microsserviços

| # | Serviço | Responsabilidade | Stack | Status |
|---|---------|------------------|-------|--------|
| 1 | `agent-service` | Orquestra o ciclo agêntico (LLM + ferramentas) | Spring Boot | ✅ Entrega 1 |
| 2 | `llm-gateway` | Proxy unificado p/ LLMs locais | LiteLLM + Ollama | ✅ Entrega 1 |
| 3 | `memory-service` | Histórico: curto prazo (Redis) + longo prazo (PostgreSQL) | Spring Boot | ✅ Entrega 3 |
| 4 | `retrieval-service` | Busca semântica / RAG + ingestão de docs | FastAPI + ChromaDB | ✅ Entrega 3 |
| 5 | `tool-registry` | Registra/expõe 7 ferramentas (calculator, datetime, db_query, knowledge_search, unit_convert, text_stats, random) | Spring Boot | ✅ remoto (porta 8084; ADR 0011) |
| 6 | `api-gateway` | Entrada única: roteamento (circuit breaker no agent-service) | Spring Cloud Gateway | ✅ Entrega 2 |
| 7 | `name-server` | Service discovery | Eureka Server | ✅ Entrega 2 |

## Protocolos de comunicação

- **Síncrono (REST/HTTP):** Cliente → `api-gateway` → `agent-service` → demais serviços.
  Gateway é o único ponto de entrada externo.
- **Service discovery:** todos registram no `name-server` (Eureka); resolução por **nome
  lógico**, nunca host/porta fixos.
- **Assíncrono (RabbitMQ, Entrega 4 ✅):** desacopla produtor/consumidor. Implementados **dois
  fluxos**: (1) **ingestão de documentos** — `agent-service` publica em `document.ingest`
  (`POST /documents/ingest` → 202); `retrieval-service` (consumer aio-pika) consome e indexa no
  ChromaDB; (2) **telemetria** — `agent-service` publica em `telemetry.events` ao fim de cada
  `/chat` (sem bloquear); `memory-service` (`@RabbitListener`) persiste em `telemetry_event`.
  Topologia: default exchange + filas duráveis nomeadas, JSON. Notificações entre agentes ficam fora.
- **Memória + RAG (síncrono, Entrega 3):** o `agent-service` resolve `lb://memory-service` e
  `lb://retrieval-service` via Eureka. No `/chat`: carrega o histórico (memory), busca trechos
  (retrieval, que embeda via `llm-gateway` e consulta o ChromaDB), injeta o contexto como `system`
  e, ao final, persiste o turno. Ingestão de documentos é síncrona nesta entrega (vira fila na 4).
- **Resiliência (Resilience4j):** circuit breaker no caminho `agent-service` → `llm-gateway`
  (fallback quando o LLM está indisponível) e breakers próprios para `memory-service`/
  `retrieval-service` (time limiter curto; fallback = sem histórico / sem RAG; o `/chat` não quebra).
- **Observabilidade (Entrega 6 ✅):** rastreamento distribuído **OpenTelemetry → Jaeger** (OTLP).
  Serviços Spring (gateway/agent/memory/tool-registry) via Micrometer Tracing; `retrieval-service`
  (Python) via auto-instrumentation. Um trace atravessa gateway → agent → memory/retrieval/tool
  (Java↔Python). Jaeger UI na 16686. Métricas (Prometheus/Grafana) ficam opcionais. ADR 0013.

## Diagrama (lógico, ASCII — substituir por versão visual no relatório)

```
            Cliente (HTTP / curl / frontend)
                        |
                        v
                 [ api-gateway ] <--- registra/descobre ---> [ name-server (Eureka) ]
                        |                                       ^ (todos os serviços registram)
                        v
                 [ agent-service ] ----------- ciclo agêntico -----------+
                    |        |              |                            |
        +-----------+        v              v                            v
        v             [ memory-service ]  [ tool-registry ]     [ retrieval-service ]
  [ llm-gateway ]      Redis (curto) +     (in-process,           |          |
        |              Postgres (longo)     Entrega 3+)     ChromaDB   embeddings
        v                                                  (vetores)       |
   [ Ollama ]  <----------------------------------------------------------+
   (LLM local: chat + embeddinggemma)

  Async (RabbitMQ, Entrega 4): agent--[document.ingest]-->retrieval (indexa);
                               agent--[telemetry.events]-->memory (persiste telemetry_event).
  Resiliência: circuit breaker agent→llm-gateway, agent→memory, agent→retrieval (Resilience4j).
  Futuro: OpenTelemetry + Jaeger + Prometheus (Entrega 6).
```

## Estado atual (Entregas 1–3)

- **Entrega 1 — Fundação:** `agent-service` recebe `POST /chat`, executa o ciclo agêntico com ≥1
  chamada ao LLM e ≥1 ferramenta (calculadora), via REST com `llm-gateway` (LiteLLM → Ollama
  `llama3.1`).
- **Entrega 2 — Infraestrutura:** `name-server` (Eureka) + `api-gateway` (Spring Cloud Gateway);
  serviços registrados e roteados por nome lógico; circuit breaker com fallback no `agent-service`.
- **Entrega 3 — Memória e RAG:** `memory-service` (Redis curto prazo + PostgreSQL longo prazo) e
  `retrieval-service` (FastAPI + ChromaDB, embeddings via `llm-gateway`). O `/chat` ganhou
  `conversationId`: carrega histórico, injeta contexto RAG (linha `rag: N trechos` no `trace`) e
  persiste o turno. Verificado ponta-a-ponta: memória nos dois níveis, RAG ancorado, discovery
  `lb://`, resiliência (memory/retrieval fora → sem 5xx) e back-compat (`/chat` sem `conversationId`).
  Decisões em ADR 0007/0008/0009. `tool-registry` remoto adiado (Entrega 3+).

- **Entrega 4 — Mensageria:** RabbitMQ (container de infra). Dois fluxos assíncronos verificados ao
  vivo: ingestão de documentos (`document.ingest`: agent-service → retrieval-service, polyglot) e
  telemetria (`telemetry.events`: agent-service → memory-service → `telemetry_event` no Postgres).
  Desacoplamento provado (fila acumula com consumer fora e drena na volta); broker fora →
  `/chat` segue e `/documents/ingest` responde 503. Decisão em ADR 0010.

- **Entrega 5 — Containerização:** Dockerfile por serviço (5 Spring multi-stage Maven→JRE; 2 Python
  slim+uv) + `docker-compose.yaml` na raiz orquestrando os 7 serviços + infra (Redis/Postgres/
  ChromaDB/RabbitMQ) + Ollama. `docker compose up` sobe a plataforma toda, 100% local; config por
  env; descoberta por nome/`lb://`. Modelos do Ollama puxados no volume. ADR 0012.

Os serviços agora rodam tanto como **processos locais** (dev) quanto **em containers** (compose).
O frontend (bônus) roda via `npm run dev` (fora do compose por ora).

- **Entrega 7 — Produção em nuvem (K8s):** manifests em `k8s/` (Namespace, ConfigMap/Secret,
  Deployments/Services dos 7 serviços + infra + Jaeger, PVCs, Ingress) reusando as imagens e a config
  por env do Compose. `kubectl kustomize k8s/` válido (35 recursos). Análise de evolução para nuvem
  (o que vira serviço gerenciado / o que escala) em `cloud-evolution.md`. ADR 0014.
