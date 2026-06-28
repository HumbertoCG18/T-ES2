# ADR 0013 — Observabilidade: rastreamento distribuído (OpenTelemetry + Jaeger) + CI

**Status:** Aceito · **Data:** 2026-06-28

## Contexto

A spec (entregável e) pede observabilidade básica com **rastreamento distribuído (OTel + Jaeger)**
OU métricas (Prometheus + Grafana), mais um **pipeline de CI** (Entrega 6). Numa arquitetura de
microsserviços, ver um pedido atravessando os serviços é o sinal mais útil para depurar latência e
falhas.

## Decisão

- **Tracing (escolhido), não métricas.** Um trace que atravessa api-gateway → agent-service →
  memory/retrieval/tool-registry mostra o ciclo agêntico distribuído — mais demonstrável que métricas
  isoladas. (Prometheus/Grafana fica opcional, como base dos benchmarks da Entrega 8.)
- **Serviços Spring (4: gateway, agent, memory, tool-registry):** Micrometer Tracing +
  `opentelemetry-exporter-otlp` (versões pelo BOM do Boot 3.5.9). Config: `management.tracing.sampling.probability=1.0`
  (dev) e `management.otlp.tracing.endpoint=${OTLP_ENDPOINT:http://localhost:4318/v1/traces}`. Auto-instrumenta
  Web e o `RestClient`; o `traceparent` (W3C) é propagado entre serviços. (`name-server` fica de fora.)
- **`retrieval-service` (Python):** OpenTelemetry **auto-instrumentation** (`opentelemetry-distro` +
  fastapi/httpx) rodando via `opentelemetry-instrument uvicorn ...`, com `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`.
  Continua o trace iniciado no agent-service (mesmo `traceId`), cruzando Java↔Python.
- **Jaeger** `all-in-one` (com `COLLECTOR_OTLP_ENABLED=true`) no `docker-compose.yaml`: recebe OTLP
  (HTTP 4318) e serve a UI na 16686. Endpoint configurável por env.
- **CI — GitHub Actions** (`.github/workflows/ci.yml`): jobs por linguagem (Java: `mvn package` nos 5
  módulos via matrix; Python: `uv sync` nos 2; Frontend: `tsc --noEmit`). Dispara em push/PR.

## Consequências

**Prós**
- Trace distribuído ponta-a-ponta (inclusive Java↔Python) num único lugar (Jaeger UI), por env.
- CI valida build+testes de todos os módulos automaticamente.
- Sem acoplamento ao backend de tracing: OTLP é padrão; trocar Jaeger por outro coletor é só de config.

**Contras / trade-offs**
- **Sampling 100% em dev** gera muitos spans; em produção, reduzir (`TRACING_SAMPLING`).
- **Métricas (Prometheus/Grafana) não incluídas** nesta entrega (a spec pede tracing OU métricas).
- **Overhead** de instrumentação (pequeno). O exporter falha silenciosamente se o Jaeger estiver fora
  (best-effort); não derruba os serviços.
- **CI não sobe a stack inteira** (build + testes unit/context-load); smoke pesado (compose/Ollama) fica fora.
