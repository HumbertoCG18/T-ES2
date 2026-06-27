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

## Comandos úteis

```
cd agent-service && .\mvnw.cmd test        # testes (não precisa de gateway/Ollama)
cd agent-service && .\mvnw.cmd package      # gera target/agent-service-0.1.0.jar
ollama list                                 # modelos locais disponíveis
```
