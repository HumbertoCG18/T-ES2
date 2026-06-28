# Runbook — subir e testar localmente

Guia operacional. Para a visão geral do projeto, ver o [`README.md`](../README.md) da raiz.

## Pré-requisitos (já instalados na máquina de dev)

Docker, JDK 21+ (testado em 25), Maven 3.9+, Python 3.11 + uv, Node, e Ollama com **dois**
modelos: `llama3.1` (chat/tool calling) e `embeddinggemma:300m` (embeddings/RAG — Entrega 3).

## Subir (local, sem containers) — 3 terminais

```
1) Ollama:       ollama serve   (já roda como serviço no Windows)  +  ollama list
2) llm-gateway:  cd llm-gateway
                 $env:OLLAMA_BASE_URL="http://localhost:11434"
                 uv run litellm --config config.yaml --port 4000
3) agent-service: cd agent-service
                 .\mvnw.cmd spring-boot:run
```

## Testar o ciclo agêntico

```
curl http://localhost:8081/chat -H "Content-Type: application/json" ^
  -d "{\"message\":\"Quanto e (12 + 8) * 3? Use a calculadora.\"}"
```

Esperado: `{ "reply": "...", "trace": ["acao: calculator(...) -> 60", ...] }`.

## Entrega 2 — Eureka + gateway + circuit breaker

Ordem de subida (4 terminais): **name-server → llm-gateway → agent-service → api-gateway**.

```
1) name-server:    cd name-server   && .\mvnw.cmd spring-boot:run     # 8761
2) llm-gateway:    (igual acima)                                       # 4000
3) agent-service:  cd agent-service && .\mvnw.cmd spring-boot:run     # 8081, registra no Eureka
4) api-gateway:    cd api-gateway   && .\mvnw.cmd spring-boot:run     # 8080, registra no Eureka
```

Provas:

```
# Dashboard do Eureka (navegador): AGENT-SERVICE e API-GATEWAY como UP
http://localhost:8761

# Acesso via gateway (discovery lb://, sem host/porta fixos)
curl http://localhost:8080/chat -H "Content-Type: application/json" ^
  -d "{\"message\":\"Quanto e (12 + 8) * 3?\"}"
```

Demonstrar o **circuit breaker** (não precisa de Ollama/LiteLLM): derrube o `llm-gateway`
(Ctrl+C no terminal 2) e chame via gateway — o `agent-service` devolve o fallback em vez de 5xx:

```
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\":\"Oi\"}"
# Esperado: { "reply": "O servico de IA esta temporariamente indisponivel...", "trace": [...] }
```

## Entrega 3 — Memória e RAG

**1) Infra em containers** (Redis 6379 · Postgres 5432 db `memory` · ChromaDB 8000):

```
docker compose -f infra/docker-compose.infra.yaml up -d
docker compose -f infra/docker-compose.infra.yaml ps          # redis/postgres healthy
curl http://localhost:8000/api/v2/heartbeat                    # chroma (sem healthcheck no compose)
```

**2) Ordem de subida** (processos locais): **name-server → infra → llm-gateway → memory-service →
retrieval-service → agent-service → api-gateway**.

```
memory-service:    cd memory-service    && .\mvnw.cmd spring-boot:run                 # 8082, Eureka
retrieval-service: cd retrieval-service && uv sync && uv run uvicorn app.main:app --port 8083  # 8083, Eureka
```

**3) Discovery:** `http://localhost:8761` → `MEMORY-SERVICE` e `RETRIEVAL-SERVICE` como `UP`.

**4) Ingerir um documento e buscar:**

```
curl http://localhost:8083/ingest -H "Content-Type: application/json" ^
  -d "{\"docId\":\"nubo1\",\"projectId\":\"p1\",\"text\":\"O codinome do projeto interno da Nubo e Andromeda. O prazo final e 03/07/2026.\"}"
curl http://localhost:8083/search -H "Content-Type: application/json" -d "{\"query\":\"codinome do projeto\",\"topK\":3}"
```

**5) Memória ponta-a-ponta (mesmo `conversationId`):**

```
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-demo\",\"message\":\"Meu nome e Humberto. Lembre-se disso.\"}"
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-demo\",\"message\":\"Qual e o meu nome?\"}"
# 2a resposta lembra "Humberto"; trace tem "memoria: N mensagens de historico carregadas"
```

**6) RAG no `/chat`:** `... "message":"Qual o codinome do projeto interno da Nubo?"` →
reply menciona **Andromeda**; trace contém `rag: N trechos recuperados`.

**7) Dois níveis (prova do curto + longo prazo):**

```
docker exec -it postgres psql -U postgres -d memory -c "SELECT role, left(content,40) FROM conversation_message WHERE conversation_id='c-demo' ORDER BY id;"
docker exec -it redis redis-cli LRANGE conv:c-demo:messages 0 -1
```

**8) Resiliência (degradação graciosa):** pare o `retrieval-service` → `/chat` ainda responde,
sem `rag:` no trace e sem 5xx. Idem parando o Redis → histórico vem do Postgres.

> **Fallback de discovery do retrieval (R1/ADR 0008):** se o `py-eureka-client` falhar, suba o
> retrieval com `EUREKA_ENABLED=false` e aponte o agent-service por URL fixa: `RETRIEVAL_URL=http://localhost:8083`.

## Entrega 4 — Mensageria (RabbitMQ)

A infra já sobe o **RabbitMQ** (`docker compose -f infra/docker-compose.infra.yaml up -d`).
UI: `http://localhost:15672` (guest/guest). Os serviços (agent/memory/retrieval) conectam no
broker no startup; sem broker, degradam graciosamente.

**1) Ingestão assíncrona (producer Spring → fila → consumer Python):**

```
curl http://localhost:8080/documents/ingest -H "Content-Type: application/json" ^
  -d "{\"docId\":\"async1\",\"projectId\":\"p1\",\"text\":\"Documento ingerido pela fila RabbitMQ.\"}"
# -> 202 {"docId":"async1","status":"queued"}; o retrieval-service loga "Indexado via fila"; depois:
curl http://localhost:8083/search -H "Content-Type: application/json" -d "{\"query\":\"fila RabbitMQ\",\"topK\":3}"
```

**2) Telemetria (não-bloqueante, persistida no Postgres):**

```
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-tel\",\"message\":\"Quanto e 7*6?\"}"
docker exec -it postgres psql -U postgres -d memory -c "SELECT conversation_id, latency_ms, iterations, rag_hits, tools_used FROM telemetry_event ORDER BY id DESC LIMIT 5;"
# ou: curl http://localhost:8082/telemetry
```

**3) Desacoplamento (prova):** parar o `retrieval-service`, publicar 2 docs e ver a fila acumular;
subir de novo → a fila drena e os docs ficam buscáveis.

```
docker exec rabbitmq rabbitmqctl list_queues name messages consumers   # autoritativo (mgmt API tem lag ~5s)
# document.ingest -> messages=2 consumers=0  (consumer fora)  =>  messages=0 consumers=1 (apos voltar)
```

**4) Broker fora (resiliência):** `docker stop rabbitmq` → `/chat` ainda responde (telemetria
best-effort) e `/documents/ingest` responde **503**. `docker start rabbitmq` → consumers reconectam.

## tool-registry (microsserviço nº 5)

Serviço Spring (porta **8084**) que expõe as ferramentas; o `agent-service` resolve por
`lb://tool-registry`. Subir: `cd tool-registry && .\mvnw.cmd spring-boot:run` (precisa do Postgres
p/ o `db_query`).

```
# Specs (via gateway) e execucao direta
curl http://localhost:8080/tools
curl http://localhost:8084/tools/calculator/execute -H "Content-Type: application/json" -d "{\"arguments\":\"{\\\"expression\\\":\\\"(12+8)*3\\\"}\"}"
curl http://localhost:8084/tools/db_query/execute   -H "Content-Type: application/json" -d "{\"arguments\":\"{\\\"sql\\\":\\\"SELECT count(*) FROM telemetry_event\\\"}\"}"

# Via /chat (ferramentas remotas)
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\":\"Quanto e (12+8)*3?\"}"
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\":\"Quantos eventos de telemetria existem? Use db_query na tabela telemetry_event.\"}"
```

Ferramentas: `calculator`, `datetime`, `db_query` (SELECT read-only; rejeita DDL/DML). Breaker
`toolRegistry`: registry fora → `/chat` responde sem ferramentas (fallback), sem 5xx.

## Entrega 5 — Plataforma toda em Docker Compose

`docker-compose.yaml` na raiz sobe os **7 serviços + infra (Redis/Postgres/ChromaDB/RabbitMQ) +
Ollama** numa rede só. Config 100% por env; serviços resolvem-se por nome e por `lb://` (Eureka).

```bash
docker compose build                                  # constroi as 7 imagens (1a vez ~minutos)
docker compose up -d                                  # sobe tudo

# Puxar os modelos uma vez (ficam no volume ollama-models):
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull embeddinggemma:300m

# Eureka: http://localhost:8761  -> AGENT/MEMORY/RETRIEVAL/TOOL-REGISTRY/API-GATEWAY UP
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\":\"Quanto e (12+8)*3?\"}"

docker compose logs -f agent-service                  # acompanhar
docker compose down                                   # parar (mantem volumes)
docker compose down -v                                # parar e apagar dados/modelos
```

> **Conflito de portas:** o compose mapeia as mesmas portas do modo "processos locais"
> (8080–8084, 8761, 4000, infra). Não rode os dois ao mesmo tempo — pare os processos locais e os
> containers de `infra/docker-compose.infra.yaml` antes de subir o compose completo.
>
> **Ollama lento:** sem GPU a inferência é por CPU (lenta). Para GPU, descomente o bloco `deploy`
> do serviço `ollama` (requer nvidia-container-toolkit). Detalhes no ADR 0012.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `Connection refused` na porta 4000 | gateway não subiu | conferir terminal do `litellm` |
| Gateway responde erro de modelo | modelo ausente no Ollama | `ollama pull llama3.1` |
| Resposta sem usar ferramenta | modelo sem tool calling confiável | usar `model: chat` (llama3.1), não `chat-light` |
| `/chat` trava muito tempo | inferência lenta (modelo grande na CPU) | trocar para `gemma3:4b` ou aumentar timeout |
| Porta 8081/8082/8083 ocupada | **instância antiga de sessão anterior** rodando | `Get-NetTCPConnection -LocalPort <p> -State Listen` → `Stop-Process -Id <pid> -Force` |
| `chromadb` aparece "unhealthy"/sem health | imagem mínima (sem curl) — não há healthcheck | normal; checar do host: `curl .../api/v2/heartbeat` |
| RAG não ancora / alucina ferramenta | modelo local 8B é variável | já mitigado no system prompt; reexecutar; `embeddinggemma` deve estar puxado |
| `MEMORY/RETRIEVAL-SERVICE` ausentes no Eureka | infra/serviço não subiu ou registro pendente | aguardar ~30s; conferir logs; checar `EUREKA_URL` |
| `/documents/ingest` responde 503 | RabbitMQ fora | subir a infra; `docker start rabbitmq` |
| Doc publicado não aparece no `/search` | consumer do retrieval fora ou ainda processando | conferir `rabbitmqctl list_queues` (consumers≥1); ver log "Indexado via fila" |
| `telemetry_event` sem linhas | broker fora na hora do `/chat` (best-effort) ou consumer do memory fora | telemetria é best-effort; checar `telemetry.events consumers=1` |
| Contagem de fila diverge na UI 15672 | stats do management API têm lag (~5s) | usar `rabbitmqctl list_queues` (autoritativo) |

## Comandos úteis

```
cd agent-service && .\mvnw.cmd test        # testes (não precisa de gateway/Ollama)
cd agent-service && .\mvnw.cmd package      # gera target/agent-service-0.1.0.jar
ollama list                                 # modelos locais disponíveis
```
