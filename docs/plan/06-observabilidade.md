# Plano — Entrega 6: Observabilidade + CI

**Status:** ✅ Concluída (verificada ao vivo) · **Atualizado:** 2026-06-28

## Objetivo

Adicionar **observabilidade** (rastreamento distribuído com **OpenTelemetry + Jaeger**) e um
**pipeline de Integração Contínua** (GitHub Actions). Atende ao entregável (e) da spec
("observabilidade básica com rastreamento distribuído OU métricas") + o item de CI da Entrega 6.

**Pronto** = (1) uma requisição (ex.: `POST /chat` ou `/tools` via gateway) gera **um trace**
visível no Jaeger UI (`:16686`) abrangendo vários serviços (api-gateway → agent-service →
memory/retrieval/tool-registry); (2) o CI roda em push/PR e builda+testa os módulos (Spring `mvn`,
Python `uv`, frontend `tsc`); (3) Jaeger no `docker-compose.yaml`; (4) sampling 100% em dev.

## Escopo

- **Inclui:**
  - **Tracing nos serviços Spring (4):** `api-gateway`, `agent-service`, `memory-service`,
    `tool-registry` — Micrometer Tracing + exporter OTLP para o Jaeger. (name-server fica de fora;
    é o servidor Eureka, pouco interessante no trace.)
  - **Tracing no `retrieval-service` (Python):** OpenTelemetry auto-instrumentation (FastAPI + httpx)
    exportando OTLP para o Jaeger — propaga o `traceparent` recebido do agent-service.
  - **Jaeger** (`jaegertracing/all-in-one`, OTLP habilitado) no `docker-compose.yaml`; UI 16686.
  - **CI — GitHub Actions** (`.github/workflows/ci.yml`): build+test dos 5 módulos Spring (`mvn -B
    package`), `uv sync` dos 2 Python, `tsc --noEmit` do frontend. Em push/PR no `main`/`dev-*`.
  - Config de tracing 100% por env (endpoint OTLP, probabilidade de sampling).
  - Docs: `architecture.md`, `runbook.md`, `plan/README.md`, ADR 0013.
- **Não inclui:**
  - **Prometheus + Grafana** (métricas) → opcional / base para os benchmarks da Entrega 8. A spec pede
    tracing **OU** métricas; entregamos tracing. (Pode-se expor `/actuator/prometheus` depois.)
  - **llm-gateway** (LiteLLM) instrumentado → opcional (o trace já mostra agent → llm-gateway como
    chamada de saída; instrumentar o LiteLLM em si fica para depois).
  - Logs estruturados/correlação avançada, alertas.

## Decisões de design

### Tracing — **Micrometer Tracing (Spring) + OTel, exporter OTLP para o Jaeger**

- Spring Boot 3.5.x: `micrometer-tracing-bridge-otel` + `opentelemetry-exporter-otlp`. Auto-instrumenta
  Web (controllers) e `RestClient`/cliente HTTP → spans encadeados com `traceparent` (W3C) propagado
  entre serviços. Config: `management.tracing.sampling.probability=1.0` (dev) e
  `management.otlp.tracing.endpoint=${OTLP_ENDPOINT:http://jaeger:4318/v1/traces}`.
- **Jaeger all-in-one** com `COLLECTOR_OTLP_ENABLED=true` recebe OTLP (HTTP 4318 / gRPC 4317) e serve a
  UI na 16686. Um receiver, um lugar para ver os traces.

### Python (`retrieval-service`) — **OpenTelemetry auto-instrumentation**

- `opentelemetry-distro` + `opentelemetry-instrumentation-fastapi`/`-httpx`; rodar via
  `opentelemetry-instrument uvicorn ...` com `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318` e
  `OTEL_SERVICE_NAME=retrieval-service`. Continua o trace iniciado no agent-service (mesmo `traceId`).

### CI — **GitHub Actions, um job por linguagem**

- Job Java (matrix dos 5 módulos): `mvn -B -ntp package`. Job Python: `uv sync` (+ smoke import).
  Job Frontend: `npm ci` + `tsc --noEmit`. Cache de Maven/uv/npm. Dispara em push/PR.

## Tarefas

| # | Tarefa | Subagent | Arquivos | Depende de |
|---|--------|----------|----------|------------|
| 1 | Validar (Context7): deps de tracing no Boot 3.5.9 (`micrometer-tracing-bridge-otel` + `opentelemetry-exporter-otlp`), chaves `management.tracing.*` / `management.otlp.tracing.endpoint`; imagem `jaegertracing/all-in-one` (OTLP, portas); `opentelemetry-instrument` no FastAPI. | `context7` | — | — |
| 2 | **Spring tracing:** deps + `application.yaml` (sampling + OTLP endpoint) nos 4 serviços (gateway, agent, memory, tool-registry). | `general-purpose` | `<svc>/pom.xml`, `<svc>/.../application.yaml` | 1 |
| 3 | **Jaeger no compose:** serviço `jaeger` (all-in-one, OTLP on, UI 16686); env `OTLP_ENDPOINT` nos 4 serviços Spring. | `cavecrew-builder` | `docker-compose.yaml` | 2 |
| 4 | **Python tracing:** `retrieval-service` com opentelemetry-distro + auto-instrumentation; Dockerfile CMD via `opentelemetry-instrument`; env OTEL_*. | `general-purpose` | `retrieval-service/{pyproject.toml,Dockerfile}` | 1,3 |
| 5 | **CI:** `.github/workflows/ci.yml` (Java matrix `mvn package` + Python `uv sync` + frontend `tsc`). | `general-purpose` | `.github/workflows/ci.yml` | — |
| 6 | **Docs + ADR 0013** (tracing OTel+Jaeger; CI). | `cavecrew-builder` | `docs/...` | 2–5 |
| 7 | **Verificação:** `docker compose up` (com Jaeger); requisição via gateway; trace multi-serviço no Jaeger UI; CI verde (ou validado localmente). | thread principal | — | 2–6 |

## Critérios de aceite

- [ ] Jaeger UI (`:16686`) mostra um **trace multi-serviço** de uma requisição via gateway.
- [ ] `traceId` propagado entre api-gateway → agent-service → (memory/retrieval/tool-registry).
- [ ] CI roda em push/PR e builda+testa os módulos (verde).
- [ ] Sampling/endpoint por env; Jaeger no compose.
- [ ] Docs + ADR 0013.

## Riscos

- **R1 — Versões do tracing (Boot 3.5.9 / OTel):** confirmar BOM e nomes das deps na Tarefa 1 (Context7).
- **R2 — Propagação Spring↔Python:** garantir W3C `traceparent`; auto-instrumentation do FastAPI/httpx cobre.
- **R3 — Overhead/sampling:** 100% em dev; em produção reduzir.
- **R4 — CI sem segredos/infra:** o CI builda e testa (unit/context-load), não sobe a stack inteira; smoke pesado fica fora.
- **R5 — Chat exige Ollama:** o trace multi-serviço pode ser obtido com `/tools`/`/services` (sem LLM) ou `/chat` (com modelos puxados); documentar.

## Verificação

```bash
docker compose up -d                       # inclui jaeger
curl http://localhost:8080/tools           # gateway -> tool-registry (2 serviços no trace)
# Jaeger UI: http://localhost:16686  -> Service: api-gateway/agent-service -> ver o trace
```
