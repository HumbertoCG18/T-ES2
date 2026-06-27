# Handoff — T-ES2 (Plataforma de Agentes Conversacionais)

**Branch:** `dev-HCG` · **Atualizado:** 2026-06-27 · **Trabalho Final de Engenharia de Software II**

Documento de transferência: leia isto + [`plan/README.md`](plan/README.md) ao retomar o projeto.

## TL;DR — onde estamos

Entregas **1, 2, 3 e 4 concluídas e verificadas ao vivo**. **Frontend bônus** (app shell completo
estilo claude.ai) funcionando ponta-a-ponta com LLM real + tool calling + `conversationId`.
Entrega 3 (Memória e RAG) **commitada** (`e126977`). **Entrega 4 (Mensageria RabbitMQ) IMPLEMENTADA**
(ingestão assíncrona + telemetria), verificada ponta-a-ponta — **a commitar** (working tree do branch
`dev-HCG`). **Próximo passo: commitar a Entrega 4 e iniciar a Entrega 5 (Containerização: Dockerfiles
+ `docker-compose.yaml` completo)**.

## Pronto (commits no `dev-HCG`)

| Commit | O quê |
|--------|-------|
| `bd5c90f` | Entrega 1 — `agent-service` + `llm-gateway` |
| `b99472d` | Entrega 2 — `name-server`, `api-gateway`, circuit breaker (verificada) |
| `e431829` | fix — Eureka self-preservation desligado em dev |
| `ec63edd` | frontend — app shell + features (markdown, LaTeX, código, timeline agêntica, projetos) |
| `b5a20a1`, `00d1710` | docs — roadmap, status, ADRs |

Working tree limpo. Sem push remoto (branch local).

## Serviços, portas e estado

| Serviço | Porta | Estado |
|---------|-------|--------|
| `name-server` (Eureka) | 8761 | ✅ pronto |
| `api-gateway` (Spring Cloud Gateway) | 8080 | ✅ pronto |
| `agent-service` (ciclo agêntico) | 8081 | ✅ pronto |
| `llm-gateway` (LiteLLM/Ollama) | 4000 | ✅ pronto |
| `frontend` (Vite/React) | 5173 | ✅ bônus |
| `memory-service` | 8082 | ✅ Entrega 3 (Redis curto + Postgres longo) |
| `retrieval-service` | 8083 | ✅ Entrega 3 (FastAPI + ChromaDB + Eureka) |
| `tool-registry` | 8084 | ✅ microsserviço nº 5 (calculator/datetime/db_query; ADR 0011) |
| Redis / PostgreSQL / ChromaDB | 6379 / 5432 / 8000 | ✅ Entrega 3 (`infra/docker-compose.infra.yaml`) |
| RabbitMQ (AMQP / UI) | 5672 / 15672 | ✅ Entrega 4 (mesma infra; guest/guest) |
| Ollama | 11434 | infra local |

> Processos de dev de sessões anteriores podem ainda estar rodando nessas portas — matar se
> necessário (Windows: `Get-NetTCPConnection -LocalPort <p> -State Listen` → `Stop-Process`).

## Como rodar do zero

Pré-requisitos (já instalados na máquina de dev): Docker, JDK 21+ (testado em 25), Maven 3.9+,
Python 3.11 + uv, Ollama (`ollama pull llama3.1` e `embeddinggemma:300m`), Node.

Ordem mínima (ver [`runbook.md`](runbook.md) para detalhes e a demo de fallback da Entrega 2):
```
1) Ollama (serviço)         2) name-server (8761)     3) llm-gateway (4000)
4) agent-service (8081)     5) api-gateway (8080)
```
Frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173.
Smoke: `curl http://localhost:8080/chat -H "Content-Type: application/json" -d '{"message":"Quanto e 2+2?"}'`.

## Entrega 3 (Memória e RAG) — CONCLUÍDA (working tree, não commitada)

Plano e critérios: [`plan/03-memoria-rag.md`](plan/03-memoria-rag.md). Entregue e verificado ao vivo:
- **`memory-service`** (Spring, 8082): Redis (curto) + PostgreSQL (longo), write-through, leitura
  Redis-first→Postgres com reheat. Endpoints `/conversations/{id}/messages|history`.
- **`retrieval-service`** (FastAPI + ChromaDB, 8083): `/ingest` + `/search`; embeddings via
  `llm-gateway` (`embeddinggemma:300m`, 768d); registra no Eureka (`py-eureka-client`).
- **`agent-service`**: `/chat` com `conversationId` (gera se ausente); carrega histórico, injeta
  contexto RAG (`rag: N trechos` no `trace`), persiste o turno. Clients `lb://` + circuit breakers
  (memory 3s / retrieval 5s) com fallback. Prompt ajustado (calculator só p/ aritmética + grounding).
- **Frontend**: `sendChat` passa o `conversationId` da conversa ativa.
- **Infra**: `infra/docker-compose.infra.yaml` (Redis/Postgres/ChromaDB; Chroma sem healthcheck).
- **Verificado:** memória 2 níveis, RAG ancorado 3/3, discovery `lb://` (4 serviços UP), resiliência
  (memory/retrieval fora → sem 5xx), back-compat. `mvn package` verde nos 2 módulos Spring.
- **ADRs:** 0007 (memória 2 níveis), 0008 (retrieval Python + discovery/fallback), 0009 (injeção RAG).

Entrega 3 **commitada** em `e126977`. Gotcha recorrente: matar instâncias antigas nas portas
8080/8081/8082/8083 antes de subir (sessões anteriores deixam processos vivos).

## Entrega 4 (Mensageria RabbitMQ) — CONCLUÍDA (working tree, a commitar)

Plano e critérios: [`plan/04-mensageria.md`](plan/04-mensageria.md). Dois fluxos assíncronos,
verificados ao vivo:
- **Ingestão assíncrona (polyglot):** `agent-service` `POST /documents/ingest` (via gateway, `Path=/documents/**`)
  publica em `document.ingest` → **202**; `retrieval-service` (consumer **aio-pika** no lifespan) consome
  e indexa no ChromaDB (reusa `index_document()`). `/ingest` síncrono continua.
- **Telemetria (não-bloqueante):** `agent-service` publica em `telemetry.events` ao fim do `/chat`
  (best-effort); `memory-service` (`@RabbitListener`) persiste `telemetry_event` no Postgres
  (`GET /telemetry`). Converter Jackson com ObjectMapper do Boot (Instant) + `TypePrecedence.INFERRED`.
- **Infra:** RabbitMQ (`rabbitmq:3-management`) no compose de infra.
- **Verificado:** 202+indexação; telemetria persistida; **desacoplamento** (consumer fora → fila
  acumula `messages=2` → drena na volta); **resiliência** (broker fora → `/chat` segue, `/documents/ingest`
  → 503; consumers reconectam). `mvn package` verde (agent/memory/gateway). ADR 0010.

**Próximo passo:** commitar a Entrega 4 e iniciar **Entrega 5 — Containerização** (Dockerfile por
serviço + `docker-compose.yaml` completo orquestrando os 7 serviços + infra).

## Método de trabalho (SADD — Sub-Agent Driven Development)

[`plan/README.md`](plan/README.md) é a fonte de estado. Por entrega: **planejar** (`plan/NN-*.md`
via Plan agent) → **decompor e delegar** a subagents → **integrar e verificar** (thread
principal) → **atualizar status** + abrir ADR se houver decisão nova.

## Decisões de arquitetura (ADRs — [`adr/`](adr/))

0001 agent-service em Spring Boot · 0002 Boot 3.5.9 / Java 21 sobre JDK 25 · 0003 LLM local
(Ollama + LiteLLM) · 0004 frontend como bônus · 0005 circuit breaker via Spring Cloud
CircuitBreaker · 0006 stack do frontend.

## Gotchas (não repetir erros já resolvidos)

- **Circuit breaker:** usar **Spring Cloud CircuitBreaker** (factory programática), **não** a
  anotação `@CircuitBreaker`/`resilience4j-spring-boot3` — dá `NoClassDefFoundError` (skew de
  versão com o BOM). Ver ADR 0005.
- **Gateway starter** (Spring Cloud 2025.0.x) = `spring-cloud-starter-gateway-server-webflux`
  (o antigo `spring-cloud-starter-gateway` foi renomeado).
- **Eureka self-preservation** desligado em dev (poucas instâncias disparam o banner
  "EMERGENCY"); religar em produção.
- **Frontend ↔ backend:** o proxy do Vite `/api` precisa de `rewrite` removendo `/api` (a rota
  do gateway é `Path=/chat/**`; sem isso → 404).
- **Modelos `*-cloud` do Ollama são proibidos** (violam "local sem nuvem").
- **LLM local é lento** → time limiter do breaker `llmGateway` = 600s (default de 1s do Spring
  Cloud cortaria inferências legítimas).
- **Frontend:** seletor de modelo é cosmético (API `/chat` não recebe modelo); arquivos/memória/
  anexos de projeto são UI + localStorage até a Entrega 3 ligar o RAG.

## Pendências e riscos

- Entrega 3 a implementar (destrava arquivos de projeto / RAG no frontend).
- Entregas 4–8 não iniciadas (RabbitMQ, containers, observabilidade/CI, K8s, relatório+vídeo).
- Entregáveis **não-código** fáceis de esquecer (ver `plan/README.md` / `README.md`): diagrama,
  relatório com **benchmarks de desempenho**, discussão de riscos, vídeo não-listado.
- Sem push remoto — só o branch local `dev-HCG`.
