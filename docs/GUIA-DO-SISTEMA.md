# Guia do Sistema — Plataforma de Agentes Conversacionais (T-ES2)

> Documento de onboarding. Lê isto e você entende **o que é o projeto, o que foi construído, como
> instalar e como rodar**. Trabalho Final de Engenharia de Software II (parceiro Nubo).

---

## 1. O que é

Um **MVP de plataforma para rodar agentes de IA conversacionais** sobre uma infraestrutura de
**microsserviços**. Um agente opera no ciclo **raciocínio → ação → observação**: recebe a pergunta,
raciocina via um LLM, pode **invocar ferramentas** (calculadora, data/hora, busca em documentos…),
observa o resultado e repete até a resposta final.

**Roda 100% local, sem nuvem** — inclusive o modelo de linguagem (Ollama). A mesma configuração serve
para **Docker Compose** (dev) e **Kubernetes** (produção).

---

## 2. Arquitetura — os 7 microsserviços

Cada serviço é um projeto **independente** (build, Dockerfile e deploy próprios). Stack poliglota.

| # | Serviço | O que faz | Stack | Porta |
|---|---------|-----------|-------|-------|
| 1 | **agent-service** | Núcleo: orquestra o ciclo agêntico (LLM + ferramentas + memória + RAG) | Spring Boot | 8081 |
| 2 | **llm-gateway** | Proxy único para o LLM local (abstrai o provedor) | LiteLLM + Ollama | 4000 |
| 3 | **memory-service** | Histórico: curto prazo (Redis) + longo prazo (PostgreSQL) | Spring Boot | 8082 |
| 4 | **retrieval-service** | Busca semântica / RAG: ingestão e busca de documentos | FastAPI + ChromaDB | 8083 |
| 5 | **tool-registry** | Registra e executa **7 ferramentas** invocáveis pelo agente | Spring Boot | 8084 |
| 6 | **api-gateway** | Porta de entrada única: roteamento + rate limiting | Spring Cloud Gateway | 8080 |
| 7 | **name-server** | Service discovery (todos se registram aqui) | Eureka Server | 8761 |

**Infra de apoio** (containers): **Redis** (6379), **PostgreSQL** (5432, db `memory`), **ChromaDB**
(8000), **RabbitMQ** (5672 + UI 15672), **Jaeger** (UI 16686), **Ollama** (11434).

**Bônus:** **frontend** (Vite + React + Tailwind) — cliente web estilo claude.ai (porta 5173).

### Como os serviços conversam

- **Síncrono (REST):** Cliente → `api-gateway` → `agent-service` → (`llm-gateway`, `memory-service`,
  `retrieval-service`, `tool-registry`). Só o gateway é exposto externamente.
- **Discovery:** todos se registram no `name-server` (Eureka). Endereços resolvem por **nome lógico**
  (`lb://memory-service`), nunca host/porta fixos.
- **Assíncrono (RabbitMQ):** dois fluxos — **ingestão de documentos** (`agent` publica → `retrieval`
  indexa) e **telemetria** (`agent` publica ao fim de cada `/chat` → `memory` persiste).
- **Resiliência (circuit breaker):** se o `llm-gateway` cai, o `agent-service` responde com **fallback**
  em vez de quebrar. Idem para memory/retrieval (sem histórico / sem RAG).
- **Observabilidade:** rastreamento distribuído **OpenTelemetry → Jaeger** (um pedido visto
  atravessando os serviços, inclusive Java↔Python).

---

## 3. O que foi desenvolvido (por entrega)

| Entrega | Entregue |
|---------|----------|
| **1 — Fundação** | `agent-service` + `llm-gateway` falando via REST; ciclo agêntico com LLM + calculadora |
| **2 — Infraestrutura** | `name-server` (Eureka) + `api-gateway` + **circuit breaker** (Resilience4j) |
| **3 — Memória e RAG** | `memory-service` (Redis + PostgreSQL) e `retrieval-service` (ChromaDB) integrados ao `/chat` (`conversationId`, histórico, contexto RAG, citações) |
| **4 — Mensageria** | RabbitMQ com **dois** fluxos assíncronos (ingestão de documentos + telemetria) |
| **5 — Containerização** | Dockerfile por serviço + `docker-compose.yaml` que sobe **tudo** com um comando |
| **6 — Observabilidade** | Tracing OpenTelemetry → Jaeger + pipeline de **CI** (GitHub Actions) |
| **7 — Produção em nuvem** | Manifests **Kubernetes** (`k8s/`) + análise de evolução para nuvem |
| **8 — Final** | *(falta)* relatório técnico + vídeo + apresentação |

**Extras já entregues:**
- **tool-registry** com **7 ferramentas**: `calculator`, `datetime`, `db_query` (SELECT read-only),
  `knowledge_search` (RAG), `unit_convert`, `text_stats`, `random`.
- **Capacidades de plataforma**: rate limiting (HTTP 429), toggles de memória/RAG por conversa,
  ver/limpar memória, saúde dos serviços ao vivo, upload de arquivo → RAG, **controles do agente no
  input do chat (modelo · esforço · raciocínio), reais** (mudam orçamento de iterações/temperatura/
  raciocínio — ADR 0015), **gerência de modelos do Ollama pela UI** (aba Modelos: baixar com barra de
  progresso %/velocidade/ETA, listar, remover — ADR 0016), citações.
- **Frontend** estilo claude.ai (polido em 3 passes): views Conversas/Projetos/Capacidades, favoritos,
  blocos de código, citar trecho, timeline do ciclo agêntico, projetos com arquivos/memória, aba
  **Infraestrutura** nas configurações (mostra Entregas 4–7 + links p/ RabbitMQ/Jaeger), logomark próprio.

**Decisões de arquitetura** estão nos **ADRs** em [`docs/adr/`](adr/) (0001–0016). O estado e o método
de trabalho ficam em [`docs/plan/README.md`](plan/README.md).

---

## 4. O que instalar (pré-requisitos)

Você precisa de:

| Ferramenta | Para quê | Versão |
|------------|----------|--------|
| **Docker + Docker Compose** | rodar tudo containerizado (caminho recomendado) | recente |
| **Ollama** | servir o LLM local | com `llama3.1` e `embeddinggemma:300m` baixados |
| Git | clonar o repo | — |

Para o **modo dev** (rodar os serviços como processos, sem containers) precisa também:

| Ferramenta | Para quê | Versão |
|------------|----------|--------|
| **JDK (Java)** | serviços Spring | 21+ (testado em 25) — o `mvnw` baixa o Maven |
| **Python + uv** | serviços FastAPI/LiteLLM | Python 3.11+; [uv](https://docs.astral.sh/uv/) |
| **Node.js** | frontend | 20+ |

> **Importante:** nunca usar modelos `*-cloud` do Ollama (violam "local sem nuvem"). Use `llama3.1`.

---

## 5. Como rodar

### Caminho A — Docker Compose (recomendado, um comando)

Sobe os 7 serviços + toda a infra + Ollama + Jaeger + **o frontend** — a plataforma inteira, sem
abrir terminais à parte.

```bash
# 1) Construir e subir tudo (1a vez ~minutos; builda 8 imagens, inclui o frontend)
docker compose up -d --build

# 2) Baixar os modelos do Ollama uma vez (ficam no volume)
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull embeddinggemma:300m

# 3) Abrir o site → http://localhost:5173   (ou testar a API direto:)
curl http://localhost:8080/chat -H "Content-Type: application/json" \
  -d '{"message":"Quanto e (12 + 8) * 3? Use a calculadora."}'

docker compose logs -f agent-service   # acompanhar
docker compose down                     # parar (mantem dados/modelos)
```

> Depois da 1a vez basta `docker compose up -d` (imagens já buildadas). Mexeu na UI?
> `docker compose up -d --build frontend`.

### Caminho B — Modo dev (processos locais, hot-reload)

Para iterar no código. **Não rode junto com o Compose** (mesmas portas).

```bash
# Infra de apoio (Redis/Postgres/ChromaDB/RabbitMQ) em containers
docker compose -f infra/docker-compose.infra.yaml up -d

# Ollama (normalmente ja roda como servico no Windows)
ollama serve

# llm-gateway (porta 4000) — PowerShell: $env:OLLAMA_BASE_URL="http://localhost:11434"
cd llm-gateway && uv run litellm --config config.yaml --port 4000

# Os serviços Spring (cada um numa aba), de dentro da pasta do serviço:
cd name-server     && .\mvnw.cmd spring-boot:run    # 8761 (subir primeiro)
cd api-gateway     && .\mvnw.cmd spring-boot:run    # 8080
cd memory-service  && .\mvnw.cmd spring-boot:run    # 8082
cd tool-registry   && .\mvnw.cmd spring-boot:run    # 8084
cd agent-service   && .\mvnw.cmd spring-boot:run    # 8081

# retrieval-service (8083)
cd retrieval-service && uv sync && uv run uvicorn app.main:app --port 8083

# frontend (5173) — opcional: já sobe no Caminho A; use só para hot-reload da UI
cd frontend && npm install && npm run dev
```

> No Linux/Mac troque `.\mvnw.cmd` por `./mvnw`.

---

## 6. Acessos e portas

| O quê | URL |
|-------|-----|
| **Frontend** (cliente web) | http://localhost:5173 |
| **API Gateway** (entrada única) | http://localhost:8080 |
| **Eureka** (serviços registrados) | http://localhost:8761 |
| **RabbitMQ** (painel) | http://localhost:15672 — login `guest` / `guest` |
| **Jaeger** (tracing) | http://localhost:16686 |

Endpoints úteis (via gateway 8080): `POST /chat`, `GET /tools`, `GET /services`,
`POST /documents/ingest`, `GET/DELETE /memory/{conversationId}`, `GET /models` ·
`POST /models/pull` · `DELETE /models/{name}` (gerência de modelos do Ollama).

---

## 7. Como verificar que está tudo no ar

```bash
# Serviços registrados no Eureka (devem aparecer UP)
curl http://localhost:8761/eureka/apps -H "Accept: application/json"

# Ferramentas disponíveis (deve listar 7)
curl http://localhost:8080/tools

# Executar uma ferramenta direto
curl http://localhost:8084/tools/calculator/execute -H "Content-Type: application/json" \
  -d '{"arguments":"{\"expression\":\"(12+8)*3\"}"}'

# Tracing: faça um /chat e veja o trace em http://localhost:16686 (serviço api-gateway/agent-service)
```

No **frontend**, a aba **Configurações → Infraestrutura** lista as capacidades (Entregas 4–7) com
links para RabbitMQ e Jaeger; a view **Capacidades** mostra ferramentas e serviços ao vivo.

---

## 8. Estrutura do repositório

```
T-ES2/
├─ agent-service/        # nucleo (Spring) — ciclo agentico
├─ llm-gateway/          # LiteLLM -> Ollama
├─ memory-service/       # Redis + PostgreSQL (Spring)
├─ retrieval-service/    # RAG (FastAPI + ChromaDB)
├─ tool-registry/        # 7 ferramentas (Spring)
├─ api-gateway/          # Spring Cloud Gateway
├─ name-server/          # Eureka
├─ frontend/             # cliente web (Vite + React) — bonus
├─ infra/                # docker-compose so da infra (dev)
├─ k8s/                  # manifests Kubernetes (Entrega 7)
├─ docker-compose.yaml   # orquestra TUDO (Entrega 5)
├─ .github/workflows/    # CI (Entrega 6)
└─ docs/                 # documentacao
   ├─ GUIA-DO-SISTEMA.md # (este arquivo)
   ├─ architecture.md    # arquitetura + diagrama ASCII
   ├─ runbook.md         # comandos de operacao
   ├─ cloud-evolution.md # evolucao p/ nuvem
   ├─ adr/               # decisoes de arquitetura (0001-0016)
   └─ plan/              # estado e planos por entrega
```

---

## 9. Problemas comuns

- **Porta ocupada / "Port 8081 already in use":** há um serviço antigo rodando. No modo dev, mate o
  processo da porta; no Compose, garanta que não está rodando o modo dev ao mesmo tempo.
- **Chat responde "serviço de IA indisponível":** o Ollama não tem o modelo. Rode os `ollama pull`.
- **Compose e dev juntos:** dão conflito de porta — use um **ou** o outro.
- **Contagem de fila no RabbitMQ:** o painel tem ~5s de atraso; a contagem autoritativa é
  `docker exec rabbitmq rabbitmqctl list_queues name messages consumers`.
- Mais comandos e detalhes em [`docs/runbook.md`](runbook.md).
