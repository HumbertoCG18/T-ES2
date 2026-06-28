# Plano — Entrega 5: Containerização

**Status:** ✅ Concluída (verificada ao vivo) · **Atualizado:** 2026-06-28

## Objetivo

Empacotar **cada serviço em um Dockerfile** e orquestrar a plataforma inteira com um
**`docker-compose.yaml`** na raiz, de modo que **`docker compose up`** suba tudo localmente,
100% offline (inclusive o LLM via Ollama). Atende ao entregável (b) da spec: "microsserviços
executando em containers Docker orquestrados via Docker Compose".

**Pronto** = (1) `docker compose build` constrói as 7 imagens; (2) `docker compose up` sobe
infra (Redis, Postgres, ChromaDB, RabbitMQ, Ollama) + os 7 serviços; (3) os serviços registram no
Eureka (`name-server`) e o `/chat` funciona via `api-gateway` (8080); (4) tudo na rede do compose,
sem hard-code de host/porta (resolve por nome de serviço/`lb://`); (5) `docker compose config` válido.

## Escopo

- **Inclui:**
  - **Dockerfile por serviço:** `agent-service`, `memory-service`, `tool-registry`, `api-gateway`,
    `name-server` (Spring, multi-stage Maven→JRE); `llm-gateway`, `retrieval-service` (Python + uv).
  - **`docker-compose.yaml`** na raiz: 7 serviços + infra (Redis, Postgres, ChromaDB, RabbitMQ) +
    **Ollama** (container, volume de modelos). Rede única; `depends_on` com `service_healthy` na infra.
  - **Config 100% por env** (já externalizada nos serviços): `EUREKA_URL`, `LLM_BASE_URL`,
    `OLLAMA_BASE_URL`, `REDIS_HOST`, `POSTGRES_URL`, `CHROMA_HOST`, `RABBITMQ_HOST`, etc.
  - **`.dockerignore`** por serviço (não copiar `target/`, `.venv/`, `node_modules/`).
  - Docs: `runbook.md` (subir via compose), `architecture.md`, `plan/README.md`, ADR 0012.
- **Não inclui:**
  - **Frontend** no compose (bônus; roda via `npm run dev`). Pode entrar depois como serviço opcional.
  - **Observabilidade / CI** → Entrega 6. **K8s** → Entrega 7.
  - GPU passthrough do Ollama (CPU por padrão; documentar que é lento e como usar GPU é opcional).
  - Pré-carregar os modelos do Ollama na imagem (são GB); são puxados no 1º uso/volume (documentado).

## Decisões de design

### Build dos serviços Spring — **multi-stage (Maven → JRE), build no container**

- `FROM maven:3.9-eclipse-temurin-21 AS build` → `mvn -q -DskipTests package` → `FROM eclipse-temurin:21-jre`
  copia o `*.jar`. Evita depender do `mvnw` (line-endings/permite cache de deps) e produz imagem enxuta.
- Cada serviço tem seu próprio `pom` (sem agregador), então cada build é independente. `JAVA_OPTS`
  externalizável. **Sem healthcheck HTTP no container** (JRE slim não tem curl); a ordenação usa
  `depends_on` + os clientes já têm retry (Eureka) e breakers.

### Build dos serviços Python — **`python:3.11-slim` + uv**

- `uv sync` no build; `CMD uv run uvicorn app.main:app --host 0.0.0.0 --port 8083` (retrieval) /
  `uv run litellm --config config.yaml --port 4000` (llm-gateway). `--host 0.0.0.0` para aceitar
  conexões de outros containers.

### Ollama em container — **serviço `ollama` + volume de modelos**

- `image: ollama/ollama`, volume `ollama-models:/root/.ollama`, porta 11434. O `llm-gateway` aponta
  `OLLAMA_BASE_URL=http://ollama:11434`. **Modelos não vão na imagem** (GB): após subir, puxar uma vez
  com `docker compose exec ollama ollama pull llama3.1` e `... pull embeddinggemma:300m` (documentado;
  ficam no volume). CPU por padrão (lento); GPU é opcional (perfil/override).

### Rede e descoberta — **nome de serviço + Eureka, sem host fixo**

- Todos na rede default do compose; resolvem-se por nome (`postgres`, `redis`, `chromadb`,
  `rabbitmq`, `ollama`, `llm-gateway`, `name-server`). Serviços Eureka registram com
  `prefer-ip-address` (IP do container, alcançável na rede) e `EUREKA_URL=http://name-server:8761/eureka`.
  O `retrieval-service` (py-eureka-client) registra com `SERVICE_HOST=retrieval-service`/IP do container.

### Ordem de subida — **`depends_on` com healthcheck só na infra**

- name-server: sem deps. Infra (redis/postgres/chromadb/rabbitmq) tem healthcheck (já no compose de infra).
- memory-service `depends_on` postgres+redis+rabbitmq (healthy) + name-server. retrieval `depends_on`
  chromadb+llm-gateway+rabbitmq+name-server. tool-registry `depends_on` postgres+name-server.
  agent-service `depends_on` llm-gateway+name-server. api-gateway `depends_on` redis+name-server.
  Deps Spring→Spring (memory/retrieval/tool) NÃO são `service_healthy` (resolvidas por `lb://` em runtime).

## Tarefas

| # | Tarefa | Subagent | Arquivos | Depende de |
|---|--------|----------|----------|------------|
| 1 | Validar (Context7): imagem `maven:3.9-eclipse-temurin-21` + `eclipse-temurin:21-jre`; `ollama/ollama` (volume `/root/.ollama`, pull); `uv` em `python:3.11-slim`; chaves do `docker compose` (depends_on condition, build context). | `context7` | — | — |
| 2 | **Dockerfiles Spring (5):** multi-stage Maven→JRE em `agent-service`, `memory-service`, `tool-registry`, `api-gateway`, `name-server` + `.dockerignore`. | `general-purpose` | `<svc>/Dockerfile`, `<svc>/.dockerignore` | 1 |
| 3 | **Dockerfiles Python (2):** `llm-gateway`, `retrieval-service` (`python:3.11-slim` + uv, host 0.0.0.0) + `.dockerignore`. | `general-purpose` | `<svc>/Dockerfile`, `<svc>/.dockerignore` | 1 |
| 4 | **`docker-compose.yaml` (raiz):** 7 serviços + infra (redis/postgres/chromadb/rabbitmq) + ollama; env, depends_on, volumes, rede. | `general-purpose` | `docker-compose.yaml` | 2,3 |
| 5 | **Docs + ADR 0012:** `runbook.md` (subir via compose + pull de modelos), `architecture.md`, `plan/README.md`. | `cavecrew-builder` | `docs/...` | 4 |
| 6 | **Verificação:** `docker compose config`; `docker compose build` (imagens); subir infra+name-server+1 Spring p/ provar imagem+registro; documentar o `up` completo. | thread principal | — | 2–5 |

## Mapa de portas / env no compose

| Serviço | Imagem/Build | Porta | Principais env |
|---------|--------------|-------|----------------|
| name-server | build ./name-server | 8761 | — |
| llm-gateway | build ./llm-gateway | 4000 | `OLLAMA_BASE_URL=http://ollama:11434` |
| ollama | `ollama/ollama` | 11434 | volume `ollama-models:/root/.ollama` |
| memory-service | build ./memory-service | 8082 | `EUREKA_URL`, `POSTGRES_URL=jdbc:postgresql://postgres:5432/memory`, `REDIS_HOST=redis`, `RABBITMQ_HOST=rabbitmq` |
| retrieval-service | build ./retrieval-service | 8083 | `EUREKA_URL`, `LLM_BASE_URL=http://llm-gateway:4000`, `CHROMA_HOST=chromadb`, `RABBITMQ_HOST=rabbitmq` |
| tool-registry | build ./tool-registry | 8084 | `EUREKA_URL`, `POSTGRES_URL`, `RETRIEVAL_URL=lb://retrieval-service` |
| agent-service | build ./agent-service | 8081 | `EUREKA_URL`, `LLM_BASE_URL=http://llm-gateway:4000`, `RABBITMQ_HOST=rabbitmq`, `MEMORY_URL/RETRIEVAL_URL/TOOLS_URL=lb://...` |
| api-gateway | build ./api-gateway | 8080 | `EUREKA_URL`, `REDIS_HOST=redis` |
| redis / postgres / chromadb / rabbitmq | imagens de infra | 6379 / 5432 / 8000 / 5672+15672 | (db `memory`) |

## Critérios de aceite

- [ ] `docker compose config` válido; `docker compose build` constrói as 7 imagens.
- [ ] `docker compose up -d` sobe infra + ollama + os 7 serviços.
- [ ] Eureka (`:8761`) lista AGENT/MEMORY/RETRIEVAL/TOOL-REGISTRY/API-GATEWAY `UP`.
- [ ] Após `ollama pull llama3.1` + `embeddinggemma:300m`: `curl :8080/chat` responde; RAG/memória/ferramentas funcionam.
- [ ] Config 100% por env (mesmo artefato serve a Compose e, na Entrega 7, a K8s).
- [ ] Docs (runbook com o passo a passo) + ADR 0012.

## Riscos

- **R1 — Build lento/pesado:** 5 builds Maven baixam deps; mitigar com cache de camadas (copiar `pom` antes do `src`). Documentar `--build` na 1ª vez.
- **R2 — Ollama em container (Windows/CPU):** inferência lenta; modelos puxados no volume (GB). GPU opcional via override. Documentar.
- **R3 — Registro no Eureka dentro da rede:** `prefer-ip-address` registra IP do container (alcançável). `retrieval` (py-eureka-client) precisa do IP/host certos — usar `SERVICE_HOST`/auto-IP.
- **R4 — Healthcheck Spring:** JRE slim sem curl; usa-se `depends_on` (ordem) + retry/breaker em vez de `service_healthy` nos serviços Spring.
- **R5 — `.dockerignore`:** evitar copiar `target/`, `.venv/`, `node_modules/` (build limpo e leve).

## Verificação (passo a passo)

```bash
docker compose config            # valida
docker compose build             # constroi as 7 imagens (1a vez ~minutos)
docker compose up -d              # sobe tudo
# Puxar modelos uma vez (ficam no volume):
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull embeddinggemma:300m
# Eureka: http://localhost:8761  (serviços UP)
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\":\"Quanto e (12+8)*3?\"}"
```
