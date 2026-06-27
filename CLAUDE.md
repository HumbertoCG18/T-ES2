# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado do repositório

**Entregas 1–3 concluídas (verificadas ao vivo).** Serviços: `agent-service/` (Spring Boot,
ciclo agêntico + Eureka client + circuit breaker + memória/RAG no `/chat`), `llm-gateway/`
(LiteLLM/Ollama, com modelo lógico `embeddings`), `name-server/` (Eureka Server, 8761),
`api-gateway/` (Spring Cloud Gateway, 8080), `memory-service/` (Spring Boot, Redis curto +
PostgreSQL longo, 8082), `retrieval-service/` (FastAPI + ChromaDB, embeddings via gateway, 8083).
Infra de apoio em containers: `infra/docker-compose.infra.yaml` (Redis/Postgres/ChromaDB). Bônus:
`frontend/` (Vite + React + Tailwind + shadcn) — app shell estilo claude.ai, chat ponta-a-ponta
com LLM real e `conversationId`; em expansão (ver `docs/plan/B-frontend.md`). Falta `tool-registry`
(adiado, Entrega 3+; `ToolRegistry` in-process atende por ora) e Entregas 4–8. **Sempre conferir
`docs/plan/README.md`** para o estado atual e o que falta. Arquitetura-alvo na spec
(`docs/t1_2026_1.pdf`). ADRs novos: 0007 (memória 2 níveis), 0008 (retrieval Python + discovery),
0009 (injeção RAG).

**Decisões já tomadas (não reabrir sem motivo):**
- `agent-service` em **Spring Boot** (não Python) — coesão com os outros 4 serviços Spring +
  Spring Cloud (Eureka, Resilience4j) exigidos pela spec.
- **Spring Boot 3.5.9**, target **Java 21**, rodando em **JDK 25** (a máquina tem 25; 3.5.7+
  detecta Java 25). Sem Lombok (compatibilidade com JDK novo). HTTP via `RestClient` (síncrono).
- Pacote base Java: `com.tes2.agent`. Group Maven `com.tes2`.
- LLM local padrão: `llama3.1:latest` (tool calling confiável). `gemma3:4b` como alternativa
  leve. **Nunca** usar modelos `*-cloud` do Ollama (violam "local sem nuvem").
- **Spring Cloud 2025.0.0** (BOM `spring-cloud-dependencies`) para Eureka/Gateway/CircuitBreaker.
  Gateway = `spring-cloud-starter-gateway-server-webflux` (não o antigo `-starter-gateway`).
- Circuit breaker = **Spring Cloud CircuitBreaker** (`spring-cloud-starter-circuitbreaker-resilience4j`,
  factory programática), **não** a anotação `@CircuitBreaker`/`resilience4j-spring-boot3` — esta
  dá `NoClassDefFoundError` por skew de versão com o BOM. Config em `ResilienceConfig.java`
  (TimeLimiter 600s: LLM local é lento). Detalhe no ADR 0005.

Trata-se do **Trabalho Final de Engenharia de Software II** — projeto extensionista com o
parceiro Nubo (https://nubo.ai/). Entrega final: **03/07/2026**. Grupos de até 5.

> Ao criar/scaffoldar um serviço, **atualize este arquivo** com os comandos reais de
> build/test/run daquele serviço (ver "Comandos" abaixo).

## O que se está construindo

Um MVP de **Plataforma de Agentes Conversacionais sobre infraestrutura de microsserviços**.
Um agente de IA opera no ciclo **raciocínio → ação → observação**: recebe a requisição,
raciocina via LLM, pode invocar ferramentas externas, observa o resultado e repete até a
resposta final. A plataforma provê a infraestrutura para esses agentes rodarem de forma
escalável, resiliente e observável.

## Arquitetura (big picture)

Sete microsserviços **independentes**. Stack **poliglota** por design — cada serviço é um
projeto isolado, com seu próprio build, Dockerfile e ciclo de deploy:

| Serviço             | Responsabilidade                                                            | Stack sugerida                          |
|---------------------|-----------------------------------------------------------------------------|-----------------------------------------|
| `agent-service`     | Orquestra o ciclo agêntico (LLM + ferramentas); núcleo da plataforma        | Spring Boot **ou** Python (FastAPI)     |
| `llm-gateway`       | Proxy unificado para LLMs locais; abstrai o provedor de LLM                  | LiteLLM + Ollama                        |
| `memory-service`    | Histórico de conversação: memória de curto e longo prazo                    | Spring Boot + Redis + PostgreSQL        |
| `retrieval-service` | Busca semântica em documentos (RAG)                                         | Python (FastAPI) + ChromaDB ou Qdrant   |
| `tool-registry`     | Registra/expõe ferramentas invocáveis pelos agentes (calculadora, DB, etc.) | Spring Boot                             |
| `api-gateway`       | Ponto de entrada único: roteamento, rate limiting, circuit breaker          | Spring Cloud Gateway                    |
| `name-server`       | Service discovery para todos os serviços                                    | Eureka Server                           |

**Fluxos de comunicação** — entender isto é o que evita erros de integração:

- **Síncrono (REST):** Cliente → `api-gateway` → `agent-service` → (`llm-gateway`,
  `memory-service`, `retrieval-service`, `tool-registry`). O gateway é o único ponto de
  entrada externo; os demais serviços não são expostos diretamente.
- **Service discovery:** todos os serviços registram-se no `name-server` (Eureka). Endereços
  resolvem-se por **nome lógico de serviço**, nunca por host/porta fixos — não hard-code
  URLs de serviço a serviço.
- **Assíncrono (RabbitMQ):** message broker desacopla produtor/consumidor. Usos previstos:
  (1) telemetria do `agent-service` (chamadas ao LLM, latência, ferramentas) publicada sem
  bloquear a resposta ao cliente; (2) ingestão de documentos enfileirada para indexação no
  `retrieval-service`, processada no ritmo do consumidor; (3) notificações entre agentes.
- **Resiliência (circuit breaker, Resilience4j):** ex. canônico — quando o `llm-gateway`
  está indisponível, o `agent-service` responde com **fallback** adequado em vez de propagar
  a falha.
- **Observabilidade:** OpenTelemetry + Jaeger (tracing distribuído) e/ou Prometheus + Grafana
  (métricas).

## Restrições inegociáveis

- **Local NÃO pode depender de nuvem.** Toda a plataforma roda offline via Docker Compose —
  inclusive o LLM (Ollama serve um modelo local). Não introduza dependências de APIs/serviços
  gerenciados de nuvem no caminho de execução local.
- **Dois alvos de execução:** Docker Compose (local/dev) e Kubernetes (produção). Mantenha a
  configuração externalizada (env vars/config) para que o mesmo artefato sirva aos dois.
- **Nomes de serviço em kebab-case**, exatamente como na tabela acima — são usados como
  identidade no Eureka, no Compose e no roteamento do gateway.

## Comandos

**Ordem de subida (local, 3 terminais):** Ollama → `llm-gateway` → `agent-service`.

- **agent-service** (porta 8081), de dentro de `agent-service/`:
  - Run: `./mvnw spring-boot:run` (Windows: `.\mvnw.cmd spring-boot:run`)
  - Testes: `./mvnw test` (não precisa do gateway/Ollama — context load + unit)
  - Teste único: `./mvnw test -Dtest=CalculatorToolTest#avaliaSomaSimples`
  - Build jar: `./mvnw package` → `target/agent-service-0.1.0.jar`
  - Config externalizada por env: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_MAX_ITERATIONS`.
- **memory-service** (porta 8082), de dentro de `memory-service/` — Entrega 3 (scaffold pronto):
  - Run: `.\mvnw.cmd spring-boot:run` (precisa de Redis+Postgres de `infra/`).
  - Build/compila: `.\mvnw.cmd -DskipTests compile` (não precisa de infra/DB).
  - Config por env: `POSTGRES_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_HOST`,
    `REDIS_PORT`, `EUREKA_URL`, `MEMORY_HISTORY_LIMIT`, `MEMORY_REDIS_TTL`.
- **retrieval-service** (porta 8083), de dentro de `retrieval-service/` — Entrega 3 (RAG, pronto):
  - Deps: `uv sync`. Run: `uv run uvicorn app.main:app --port 8083` (`--reload` em dev).
  - Precisa de ChromaDB (8000) + llm-gateway (4000, embeddings) + Ollama (`embeddinggemma:300m`).
  - Endpoints: `POST /ingest`, `POST /search`, `DELETE /documents/{docId}`, `GET /health`.
  - Registra-se no Eureka como `RETRIEVAL-SERVICE` (`py-eureka-client`); `EUREKA_ENABLED=false`
    desliga e usa-se URL fixa no agent-service (`RETRIEVAL_URL`). Embeddings: `embeddinggemma:300m` (768d).
- **Infra da Entrega 3** (Redis 6379 / Postgres 5432 db `memory` / ChromaDB 8000):
  - `docker compose -f infra/docker-compose.infra.yaml up -d` (down `-v` apaga dados).
  - ChromaDB sem healthcheck (imagem mínima); readiness: `curl http://localhost:8000/api/v2/heartbeat`.
- **llm-gateway** (porta 4000), de dentro de `llm-gateway/`:
  - `OLLAMA_BASE_URL` no ambiente, depois `uv run litellm --config config.yaml --port 4000`
  - PowerShell: `$env:OLLAMA_BASE_URL="http://localhost:11434"`
- **Ollama:** `ollama serve` (já roda como serviço no Windows) / `ollama pull llama3.1` /
  `ollama list`. Endpoint local: `http://localhost:11434`.
- **Smoke test do ciclo agêntico:**
  `curl http://localhost:8081/chat -H "Content-Type: application/json" -d '{"message":"Quanto e (12 + 8) * 3?"}'`
- **Stack completa:** `docker compose up` (ainda não existe — `docker-compose.yaml` chega na
  Entrega 5).
- **Serviços Python/FastAPI futuros:** `uv run uvicorn app.main:app --reload` / `uv run pytest`.

## Método de trabalho (Sub-Agent Driven Development)

O fluxo de execução vive em [`docs/plan/`](docs/plan/README.md) — **fonte única** de estado e
método. Antes de codar qualquer entrega:

1. **Planejar** — criar `docs/plan/NN-<nome>.md` (escopo, tarefas, arquivos, critérios de
   aceite, riscos) a partir do `_template.md`. Não codar entrega sem plano.
2. **Decompor e delegar a subagents** — `Explore`/`cavecrew-investigator` (localizar),
   `cavecrew-builder` (edição 1–2 arquivos), `Plan` (arquitetura), `general-purpose`
   (multi-step isolado).
3. **Integrar e verificar** — thread principal junta, builda, roda testes/smoke.
4. **Atualizar estado** — marcar status na tabela de `docs/plan/README.md`; atualizar
   `docs/architecture.md` e abrir ADR (`docs/adr/`) se houver decisão de arquitetura nova.

Ao concluir uma entrega, atualizar também a tabela de status aqui e no `README.md`.

## Sequência de trabalho (entregas incrementais)

A spec sugere construir em fases — siga esta ordem para manter cada incremento executável:

1. **Fundação** — `agent-service` + `llm-gateway` (Ollama) comunicando via REST, localmente,
   sem containers.
2. **Infraestrutura** — `name-server` (Eureka) + `api-gateway` + circuit breaker; serviços
   registrados e acessíveis via gateway.
3. **Memória e RAG** — `memory-service` (Redis + PostgreSQL) e `retrieval-service` (ChromaDB)
   integrados ao `agent-service`.
4. **Mensageria** — RabbitMQ para ≥1 fluxo assíncrono (ingestão de documentos, telemetria).
5. **Containerização** — Dockerfile por serviço + `docker-compose.yaml` orquestrando tudo.
6. **Observabilidade** — OpenTelemetry + Jaeger; pipeline de CI.
7. **Produção em nuvem** — descrição das alterações/artefatos para rodar em Kubernetes
   (manifests YAML; cluster rodando é opcional, não exigido).
8. **Entrega final** — relatório técnico + vídeo de demonstração (YouTube não listado).

**Bônus (fora da spec):** `frontend` — UI de chat com **shadcn/ui** (React) sobre `POST /chat`,
só para clarear a demonstração em vídeo da Entrega 8. Manter mínimo; não consumir esforço do
backend. Skills `shadcn` / `frontend-design` em `.agents/` cobrem isso.

## Entregáveis que definem "pronto"

Além do código funcional, a nota depende de artefatos específicos — verifique-os ao concluir:
(a) diagrama de arquitetura; (b) plataforma rodando em Docker Compose com ciclo agêntico
funcional (≥1 chamada ao LLM + ≥1 ferramenta), Ollama local, persistência de memória, gateway
com roteamento + circuit breaker, discovery via Eureka; (c) ≥1 fluxo assíncrono via RabbitMQ;
(d) circuit breaker **demonstrável** (cenário de fallback real, ex.: llm-gateway fora do ar);
(e) observabilidade básica; (f) relatório técnico com decisões de arquitetura e trade-offs;
(g) análise de evolução para nuvem; (h) descrição das mudanças para rodar em Kubernetes.

**Não esquecer (não-código, valem nota, fáceis de perder):** diagrama de arquitetura;
**experimentação / avaliação de desempenho** (benchmarks de latência/throughput com
interpretação crítica — exigido explicitamente pela spec); **discussão de riscos** (segurança,
performance, escalabilidade, disponibilidade); pipeline de CI (Entrega 6); vídeo no YouTube
não-listado + apresentação final. `memory-service` precisa dos **dois** níveis: Redis (curto
prazo) **e** PostgreSQL (longo prazo).

## Tooling

`.agents/skills/` (gerenciado por `skills-lock.json`) traz skills de apoio — `docker-expert`
é o mais relevante para containerização/Compose/K8s. As skills de frontend (`shadcn`,
`frontend-design`, `web-design-guidelines`) só se aplicam caso o grupo adicione uma UI/cliente
web, fora do escopo mínimo dos 7 microsserviços.
