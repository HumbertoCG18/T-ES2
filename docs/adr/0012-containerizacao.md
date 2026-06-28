# ADR 0012 — Containerização: Dockerfile por serviço + docker-compose completo

**Status:** Aceito · **Data:** 2026-06-28

## Contexto

A spec exige a plataforma "executando em containers Docker orquestrados via Docker Compose"
(Entrega 5). São 7 microsserviços (5 Spring, 2 Python) + infra (Redis, Postgres, ChromaDB,
RabbitMQ) + o LLM local (Ollama). Tudo deve subir com `docker compose up`, 100% offline.

## Decisão

- **Serviços Spring (5):** Dockerfile **multi-stage** — `maven:3.9-eclipse-temurin-21` (build:
  `mvn -DskipTests package`) → `eclipse-temurin:21-jre` (runtime, copia o `*.jar`). Build dentro do
  container (auto-contido, sem depender do `mvnw`/line-endings); imagem final enxuta (JRE).
- **Serviços Python (2):** `python:3.11-slim` + **uv** (copiado da imagem `ghcr.io/astral-sh/uv`),
  `uv sync` no build; `--host 0.0.0.0` para aceitar conexões de outros containers.
- **`docker-compose.yaml` na raiz:** os 7 serviços + infra + **Ollama** (`ollama/ollama`, volume
  `ollama-models`). Rede default do compose; serviços resolvem-se por **nome** (`postgres`, `redis`,
  `chromadb`, `rabbitmq`, `ollama`, `llm-gateway`, `name-server`) e por **`lb://`** via Eureka.
- **Config 100% por env** (já externalizada): `EUREKA_URL`, `LLM_BASE_URL`, `OLLAMA_BASE_URL`,
  `POSTGRES_URL`, `REDIS_HOST`, `CHROMA_HOST`, `RABBITMQ_HOST`, etc. Mesmo artefato serve ao Compose
  e (Entrega 7) ao Kubernetes.
- **Descoberta na rede:** serviços Spring registram com `prefer-ip-address` (IP do container,
  alcançável na rede). O `retrieval-service` (py-eureka-client) registra com `SERVICE_HOST=retrieval-service`
  (resolvido pelo DNS do compose) — o `lb://retrieval-service` do agent-service resolve por esse hostname.
- **Ordem de subida:** `depends_on` com `service_healthy` apenas na **infra** (que tem healthcheck);
  os serviços Spring usam `service_started` + **retry do Eureka / circuit breaker** em vez de
  healthcheck HTTP (a imagem JRE slim não traz curl/wget).
- **Modelos do Ollama fora da imagem:** são GB; puxados uma vez para o volume
  (`docker compose exec ollama ollama pull llama3.1` / `embeddinggemma:300m`).

## Consequências

**Prós**
- `docker compose up` sobe a plataforma toda; build reprodutível e auto-contido (`docker compose build`).
- Sem hard-code de host/porta: resolve por nome de serviço/`lb://`. Pronto para evoluir a K8s.
- Imagens de runtime enxutas (JRE / slim).

**Contras / trade-offs**
- **Build pesado na 1ª vez:** 5 builds Maven baixam dependências; mitigado pelo cache de camadas
  (copiar `pom.xml` antes do `src`).
- **Ollama em container (CPU):** inferência lenta sem GPU; GPU é opcional (bloco `deploy` comentado +
  nvidia-container-toolkit). Modelos ocupam GB no volume.
- **Sem healthcheck HTTP nos serviços Spring:** a prontidão depende de retry/breaker, não de
  `service_healthy`. Aceitável (os clientes já toleram dependência ainda subindo).
- **Frontend fora do compose** (bônus; roda via `npm run dev`). Pode virar serviço opcional depois.
