# Plano — Entrega 3: Memória e RAG

**Status:** ✅ Concluída (verificada ao vivo) · **Atualizado:** 2026-06-27

## Objetivo

Adicionar **memória de conversação** e **RAG** à plataforma, criando dois microsserviços novos e integrando-os ao `agent-service`:

- **`memory-service`** (Spring Boot + **Redis** curto prazo + **PostgreSQL** longo prazo, Eureka client) — salva e recupera o histórico por `conversationId`.
- **`retrieval-service`** (Python FastAPI + **ChromaDB**, Eureka client) — ingestão de documentos (embeddings via `llm-gateway`) e busca semântica.
- **`agent-service`** passa a receber `conversationId` no `POST /chat`, carrega o histórico no início do ciclo, consulta o `retrieval-service` (RAG) antes de chamar o LLM, injeta os trechos relevantes no prompt e persiste a troca ao final.

**Pronto** = (1) duas requisições `/chat` com o mesmo `conversationId` demonstram memória (o agente "lembra" da troca anterior), com o registro visível no PostgreSQL **e** no Redis; (2) após ingerir um documento via `retrieval-service`, uma pergunta cuja resposta só está no documento volta **ancorada no documento** (e o `trace` mostra que houve recuperação); (3) `memory-service` e `retrieval-service` aparecem `UP` no dashboard do Eureka; (4) `mvn package` verde nos módulos Spring e o `retrieval-service` sobe sem erro. Tudo **100% local, sem nuvem**.

## Escopo

- **Inclui:**
  - Módulo Maven novo **`memory-service/`** (porta **8082**, pacote `com.tes2.memory`): Spring Data Redis + Spring Data JPA/PostgreSQL, Eureka client, API REST de salvar/recuperar histórico por `conversationId`.
  - Projeto Python novo **`retrieval-service/`** (porta **8083**, gerenciado por **uv**): FastAPI + cliente ChromaDB + cliente de embeddings (httpx → `llm-gateway`) + registro no Eureka (`py-eureka-client`). Endpoints de **ingestão** e **busca semântica**.
  - Integração no **`agent-service`**: `conversationId` no DTO de `/chat`; `MemoryClient` e `RetrievalClient` (RestClient com discovery `lb://` + circuit breaker); carregamento/persistência de histórico e injeção de contexto RAG no `AgentLoop`.
  - **Infra local em containers** via `docker run` ou um **compose parcial de INFRA** (`infra/docker-compose.infra.yaml`): Redis, PostgreSQL, ChromaDB. Não depende de nuvem.
  - Atualização de docs: `architecture.md`, `plan/README.md`, `runbook.md` e ADRs novos.
  - (Bônus, não-bloqueante) `frontend` passa o `conversationId` da conversa ativa no `POST /api/chat`.
- **Não inclui:**
  - **RabbitMQ / ingestão assíncrona** → **Entrega 4**. Nesta entrega a ingestão é **síncrona** (`POST /ingest` bloqueia até indexar). O contrato já é desenhado para depois virar fila.
  - **Dockerfiles dos serviços próprios** (`memory-service`, `retrieval-service`, etc.) e o `docker-compose.yaml` completo → **Entrega 5**. Aqui só sobem **containers de infra** (Redis/Postgres/Chroma); os serviços rodam como processos locais.
  - **`tool-registry`** → fora desta entrega (ver "Decisões de design"). O `ToolRegistry` in-process atual permanece; evolui em entrega posterior.
  - Upload de arquivos do frontend ligado de fato ao RAG → apenas **sinalizado** o ponto de conexão (ver "Conexão futura do frontend"); a UI continua em localStorage por ora.
  - Observabilidade/OpenTelemetry → Entrega 6. Auth/rate-limit no gateway → fora do critério.

## Decisões de design (recomendações com justificativa)

### Split Redis (curto prazo) vs PostgreSQL (longo prazo) — **write-through nos dois; leitura prefere Redis**

- **PostgreSQL = fonte da verdade (longo prazo):** todo turno persistido de forma durável e consultável (tabela relacional, sobrevive a restart). Atende ao requisito explícito da spec de **dois níveis**.
- **Redis = cache de sessão ativa (curto prazo):** as últimas **N** mensagens da conversa em uma **List** (`LPUSH` + `LTRIM` para capar em N) com **TTL** (ex.: 1h) representando a "sessão ativa". Leitura rápida no caminho quente do `/chat`.
- **Escrita:** *write-through* — ao anexar um turno, grava no Postgres **e** atualiza a List do Redis. **Leitura:** tenta Redis primeiro; em *miss* (TTL expirou / cache frio), carrega as últimas N do Postgres e **reaquece** o Redis. Isso torna o split **demonstrável** (derrubar o Redis → histórico continua vindo do Postgres; inspecionar a key no Redis → mostra a sessão quente).
- **O que persistir:** o **turno conversacional** — a mensagem `user` e a resposta final `assistant`. As mensagens intermediárias `tool`/tool-calls do ciclo agêntico ficam **efêmeras** no loop (não poluem o histórico recarregado como contexto do LLM). Registrado como decisão para manter o histórico limpo e re-injetável.

### Embeddings sempre via `llm-gateway` — **quem embeda é o `retrieval-service`, não o `agent-service`**

- O `agent-service` **não** calcula embeddings; ele manda **texto puro** ao `retrieval-service` (`/search`), que faz o embedding via `llm-gateway` (`POST /v1/embeddings`, modelo lógico `embeddings` = `embeddinggemma:300m`). Centraliza a abstração de provedor de embeddings num único ponto e respeita a regra "embeddings sempre via `llm-gateway`, nunca provedor de nuvem".
- A ingestão segue o mesmo caminho: `retrieval-service` recebe o documento, faz *chunking*, embeda **cada chunk** via `llm-gateway` e faz *upsert* no ChromaDB.

### Injeção de contexto RAG — **system message dedicada antes da mensagem do usuário**

- Antes do loop, o `agent-service` chama `retrieval-service /search` com a mensagem do usuário. Se houver *hits*, monta um bloco de contexto e o injeta como uma **`ChatMessage.system` adicional** (logo após o system prompt principal, antes da `user`): *"Contexto recuperado dos documentos do usuário (use se for relevante; não invente):\n<trechos>"*. Mantém a mensagem do usuário intacta e deixa claro ao modelo que é material de apoio.
- Adiciona-se uma linha ao `trace`: `"rag: N trechos recuperados"`, tornando a recuperação **visível** na timeline (o frontend já renderiza `trace`).
- **Sem hits ou serviço fora:** segue sem contexto (degradação graciosa via fallback do circuit breaker).

### Descoberta do serviço Python no Eureka — **`py-eureka-client` (primário) com fallback de URL fixa**

- **Recomendado:** registrar o `retrieval-service` no Eureka com **`py-eureka-client`** (init no *lifespan* do FastAPI, com heartbeat e *deregister* no shutdown). Assim o `agent-service` o resolve por **`lb://retrieval-service`**, uniforme com os demais — cumprindo o texto da spec ("retrieval-service ... Eureka client").
- **Justificativa de ser a opção mais simples viável:** alternativas (sidecar de registro, expor por rota estática no gateway) adicionam mais peças. `py-eureka-client` é uma única dependência e roda no próprio processo.
- **Contingência documentada (não-bloqueante):** se o `py-eureka-client` se mostrar instável no Windows, o `agent-service` cai para **URL fixa externalizada** (`RETRIEVAL_URL=http://localhost:8083`) — há **precedente no repo**: o `llm-gateway` (também Python/LiteLLM) **não** se registra no Eureka e é acessado por URL fixa (`LLM_BASE_URL`). O `RetrievalProperties.base-url` aceita tanto `lb://retrieval-service` quanto `http://host:porta`, então a troca é só de configuração. Vira **ADR**.
- O **`memory-service` (Spring) registra-se normalmente** no Eureka (como o `agent-service`/`api-gateway`); o `agent-service` o resolve por `lb://memory-service`.

### RestClient com discovery (`lb://`) — **novo builder `@LoadBalanced`**

- O `RestClientConfig` atual cria um `llmRestClient` com **baseUrl fixa** (o `llm-gateway` não está no Eureka). Para os serviços novos é preciso um **`RestClient.Builder` anotado com `@LoadBalanced`** (Spring Cloud LoadBalancer, já vem com o `eureka-client`) para resolver `lb://memory-service` / `lb://retrieval-service`. Adicionar esse builder e dele derivar `memoryRestClient` e `retrievalRestClient`. Não mexer no `llmRestClient`.

### Circuit breaker nas novas dependências — **breakers próprios, *time limiter* curto**

- Envolver as chamadas a `memory-service` e `retrieval-service` em breakers próprios (`memoryService`, `retrievalService`) via o mesmo `CircuitBreakerFactory` já usado no `LlmClient` (API programática do Spring Cloud CircuitBreaker — **não** a anotação `@CircuitBreaker`; ver ADR 0005). Diferente do `llmGateway` (time limiter 600s, pois LLM local é lento), estes são serviços rápidos: time limiter **curto** (ex.: 2–3s). Fallback: histórico vazio / sem contexto RAG / persistência silenciosamente pulada → o `/chat` **nunca** quebra por causa de memória/RAG.

### ChromaDB como **container servidor** (HttpClient), não embarcado

- A spec/infra pede ChromaDB **em container**. Roda-se `chromadb/chroma` na **8000**; o `retrieval-service` usa `chromadb.HttpClient(host, 8000)`. Resolve também o conflito de portas: **ChromaDB 8000**, **retrieval-service 8083**.

### `tool-registry` — **adiar (recomendação)**

- A spec lista o `tool-registry`, mas Memória + RAG já é uma entrega grande, e o `ToolRegistry.java` atual (coleta beans `Tool` in-process) **já atende** o ciclo agêntico. O próprio comentário do código prevê evolução posterior. **Recomendo manter o registry local nesta entrega** e tratar o `tool-registry` remoto como item de uma entrega futura (anotar em `architecture.md` como "Entrega 3+"). Evita dispersar esforço do caminho crítico (memória persistente + RAG demonstrável).

## Tarefas (decomposição para subagents)

| # | Tarefa | Subagent sugerido | Arquivos | Depende de |
|---|--------|-------------------|----------|------------|
| 1 | Confirmar artefatos/contratos: starters `spring-boot-starter-data-redis` e `-data-jpa` + driver `org.postgresql:postgresql` no BOM Boot 3.5.9; imagem ChromaDB (`chromadb/chroma`) e API do `HttpClient`; contrato de **embeddings** do LiteLLM (`POST /v1/embeddings`, body `{model,input}`, resposta `data[].embedding`); viabilidade do `py-eureka-client` (heartbeat/lifespan). Confirmar dimensão do `embeddinggemma:300m` (768). | `Explore` / `context7` | — (leitura) | — |
| 2 | **INFRA em containers:** criar `infra/docker-compose.infra.yaml` com Redis 7, PostgreSQL 16 (db `memory`, user/pass `postgres`) e ChromaDB (porta 8000), com volumes locais. Documentar também os `docker run` equivalentes. **Sem** Dockerfiles de serviço (isso é Entrega 5). | `general-purpose` | `infra/docker-compose.infra.yaml` | — |
| 3 | **memory-service — scaffold:** `pom.xml` (parent Boot 3.5.9, `<java.version>21</java.version>`, BOM `spring-cloud-dependencies:2025.0.0`, deps: `spring-boot-starter-web`, `-validation`, `-actuator`, `-data-redis`, `-data-jpa`, `org.postgresql:postgresql`, `spring-cloud-starter-netflix-eureka-client`, `-starter-test`), `MemoryServiceApplication.java` (`@SpringBootApplication @ConfigurationPropertiesScan`, pacote `com.tes2.memory`), `application.yaml` (porta 8082, datasource Postgres + Redis + Eureka + actuator, `prefer-ip-address: true`). | `general-purpose` | `memory-service/pom.xml`, `memory-service/src/main/java/com/tes2/memory/MemoryServiceApplication.java`, `memory-service/src/main/resources/application.yaml`, wrapper mvnw | 1 |
| 4 | **memory-service — domínio + API:** entidade JPA `ConversationMessage` (+ opcional `Conversation`), `ConversationMessageRepository`, serviço de memória com *write-through* Redis (`StringRedisTemplate` List `LPUSH`+`LTRIM`+`EXPIRE`) e leitura Redis-first→Postgres, DTOs, `MemoryController`. Schema via `ddl-auto: update` (Flyway = evolução futura). | `general-purpose` | `memory-service/src/main/java/com/tes2/memory/{domain,repo,service,web,config}/*.java` | 3 |
| 5 | **retrieval-service — scaffold (uv):** `pyproject.toml` (`fastapi`, `uvicorn[standard]`, `chromadb`, `httpx`, `pydantic`, `py-eureka-client`), `app/main.py` (FastAPI + `/health`), `app/config.py` (env), `README.md`. | `general-purpose` | `retrieval-service/{pyproject.toml,app/__init__.py,app/main.py,app/config.py,README.md}` | 1 |
| 6 | **retrieval-service — RAG:** `app/embeddings.py` (httpx → `/v1/embeddings`), `app/chroma.py` (`HttpClient`, `get_or_create_collection("knowledge")`), `app/chunking.py`, `app/models.py` (pydantic), endpoints `POST /ingest` e `POST /search` (+ opcional `DELETE /documents/{doc_id}`). Metadados: `project_id`, `doc_id`, `chunk_index`. | `general-purpose` | `retrieval-service/app/{embeddings,chroma,chunking,models,main}.py` | 5 |
| 7 | **retrieval-service — Eureka:** `app/eureka.py` (registro via `py-eureka-client` no *lifespan*; nome lógico `retrieval-service`, porta 8083). | `cavecrew-builder` | `retrieval-service/app/eureka.py`, `retrieval-service/app/main.py` | 5 |
| 8 | **agent-service — DTO + controller + loop signature:** `ChatRequest` ganha `conversationId` (opcional; se ausente, gera e devolve em `ChatResponse`); `ChatController` repassa; `AgentLoop.run(conversationId, userMessage)`. | `cavecrew-builder` | `agent-service/.../web/ChatController.java`, `.../agent/AgentLoop.java` | — |
| 9 | **agent-service — clients novos:** `@LoadBalanced RestClient.Builder`; beans `memoryRestClient` (`lb://memory-service`) e `retrievalRestClient` (`lb://retrieval-service`, fallback URL fixa); `MemoryClient`/`RetrievalClient` com circuit breaker e fallbacks; `MemoryProperties`/`RetrievalProperties`; customizers em `ResilienceConfig`; chaves no `application.yaml`. | `general-purpose` | `agent-service/.../config/*.java`, `.../memory/*`, `.../retrieval/*`, `application.yaml` | 8 |
| 10 | **agent-service — orquestração no `AgentLoop`:** carregar histórico, montar `system + histórico + user`; `RetrievalClient.search` + injeção de `system` com trechos + linha no `trace`; ao final `MemoryClient.appendTurn`. | `cavecrew-builder` | `agent-service/.../agent/AgentLoop.java` | 9 |
| 11 | **(Bônus) frontend — passar `conversationId`:** `sendChat(message, conversationId)` e o `store` envia o `id` da conversa ativa. | `cavecrew-builder` | `frontend/src/lib/api.ts`, `frontend/src/store/store.tsx` | 8 |
| 12 | **Docs + ADRs:** `architecture.md`, `plan/README.md`, `runbook.md`; ADR 0007 (split Redis/Postgres), 0008 (retrieval Python + discovery/fallback), 0009 (injeção RAG); `adr/README.md`. | `cavecrew-builder` | `docs/...` | 2–10 |
| 13 | **Integração e verificação (thread principal):** subir infra, `mvn package`, subir os 7 processos, ingerir doc, validar memória + RAG, checar Postgres/Redis e Eureka. | thread principal | — | 2–11 |

## Tarefa 1 — resultados da validação (✅ 2026-06-27, via Context7 + repo)

- **Starters Boot 3.5.9 (BOM):** `spring-boot-starter-data-redis`, `spring-boot-starter-data-jpa` e `org.postgresql:postgresql` são gerenciados pelo dependency management do Boot — **sem versão explícita** no `pom.xml`. OK.
- **ChromaDB:** imagem **`chromadb/chroma:1.5.3`** (porta 8000, volume `/data`, opcional `CONFIG_PATH`). Cliente: `chromadb.HttpClient(host, port=8000, ssl=False)`; `client.get_or_create_collection(name="knowledge", embedding_function=None)` (embeddings pré-computados); `collection.upsert(ids, documents, embeddings, metadatas)`; `collection.query(query_embeddings, n_results, where, include=["documents","distances"])`. **Dimensão fixada no 1º embedding e imutável** → uma coleção, um modelo (R2 confirmado).
- **LiteLLM `/v1/embeddings`:** contrato OpenAI-compatível confirmado. Req `{ "model": "embeddings", "input": "<str ou [str]>" }`; resp `{ "object":"list", "data":[ { "object":"embedding", "embedding":[...], "index":0 } ], "model", "usage" }` → ler `data[].embedding`. O `llm-gateway/config.yaml` **já tem** `model_name: embeddings` → `ollama/embeddinggemma:300m` (prefixo `ollama/`, correto p/ embeddings).
- **Ollama:** `embeddinggemma:300m` (621 MB) e `llama3.1:latest` já puxados. `embeddinggemma:300m` = **768 dims** (full; MRL trunca p/ 512/256/128 — usar full 768). Confirma R2/R8.
- **`py-eureka-client`:** Context7 **não tem** entry (só Netflix Eureka). API conhecida (`eureka_client.init(...)` no lifespan, `stop()` no shutdown). Mantém **fallback URL fixa** (`RETRIEVAL_URL`) já planejado — R1/ADR 0008.

## Endpoints dos serviços novos (contratos)

### `memory-service` (porta 8082, `lb://memory-service`)

- `POST /conversations/{conversationId}/messages` — anexa 1+ mensagens (write-through Redis+Postgres). Body: `{ "messages": [ { "role": "user", "content": "..." } ] }`. Resp `201` `{ "saved": 2 }`.
- `GET /conversations/{conversationId}/messages?limit=20` — histórico recente (Redis-first, fallback Postgres), ordem antiga→nova.
- `GET /conversations/{conversationId}/history` — histórico completo (sempre Postgres). *(opcional, prova do nível durável.)*
- `DELETE /conversations/{conversationId}` — limpa Redis + Postgres. *(opcional.)*
- `GET /actuator/health`.

### `retrieval-service` (porta 8083, `lb://retrieval-service`)

- `POST /ingest` — `{ "docId", "projectId", "text", "metadata" }` → chunk + embed + upsert. Resp `{ "docId", "chunksIndexed": 7 }`.
- `POST /search` — `{ "query", "topK": 4, "projectId?" }` → embed query + Chroma query. Resp `{ "hits": [ { "text", "score", "metadata" } ] }`.
- `GET /health`. `DELETE /documents/{docId}` *(opcional)*.

### Schema PostgreSQL (`memory-service`)

```sql
CREATE TABLE conversation_message (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id VARCHAR(64)  NOT NULL,
    role            VARCHAR(20)  NOT NULL,   -- user | assistant | system | tool
    content         TEXT,
    tool_call_id    VARCHAR(64),
    name            VARCHAR(64),
    created_at      TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_conversation ON conversation_message (conversation_id, id);
```

Redis: key `conv:{conversationId}:messages` = **List** de mensagens (JSON), capada via `LTRIM 0 N-1`, com `EXPIRE` (TTL de sessão).

## Portas e endpoints

| Serviço | Tipo | Porta | Nome lógico (Eureka) | Endpoints-chave |
|---------|------|-------|----------------------|-----------------|
| `name-server` | existente | 8761 | (não se registra) | Dashboard `:8761` |
| `api-gateway` | existente | 8080 | `api-gateway` | `POST /chat` → `lb://agent-service` |
| `agent-service` | **alterado** | 8081 | `agent-service` | `POST /chat` (agora com `conversationId`) |
| `llm-gateway` | existente | 4000 | (não se registra) | `/v1/chat/completions`, `/v1/embeddings` |
| **`memory-service`** | **novo** | **8082** | `memory-service` | `/conversations/{id}/messages` |
| **`retrieval-service`** | **novo** | **8083** | `retrieval-service` | `/ingest`, `/search`, `/health` |
| Redis | infra (container) | **6379** | — | curto prazo |
| PostgreSQL | infra (container) | **5432** | — | longo prazo (db `memory`) |
| ChromaDB | infra (container) | **8000** | — | vetores (`HttpClient`) |
| Ollama | infra | 11434 | — | backend do `llm-gateway` |

> `memory-service` e `retrieval-service` são **internos** (chamados pelo `agent-service`); **não** são expostos pelo `api-gateway` nesta entrega.

## Conexão futura do frontend (sinalizar)

O frontend já modela `Conversation.id` (vira o `conversationId`) e `Project.files: ProjectFile[]` com `text`. **Ponto de ligação futuro:** o upload de arquivos do projeto (hoje só localStorage) chamará `retrieval-service POST /ingest` com `projectId = Project.id` e `docId = ProjectFile.id`; e o `/chat` poderá enviar o `projectId` para filtrar o `/search`. Para o frontend alcançar o `retrieval-service`, abre-se no futuro uma rota no `api-gateway` (`Path=/ingest/**` → `lb://retrieval-service`). **Nesta entrega isso fica documentado, não implementado** (ingestão exercitada via `curl`). Já dá para ligar agora apenas o `conversationId` (tarefa 11).

## Critérios de aceite

- [ ] **Memória persiste entre requests:** dois `/chat` com o mesmo `conversationId` — no 2º a resposta usa info dada no 1º.
- [ ] **Dois níveis demonstráveis:** conversa aparece como linhas no PostgreSQL **e** como List no Redis; derrubar o Redis e repetir `/chat` ainda recupera (via Postgres).
- [ ] **Ingestão + RAG:** após `/ingest`, pergunta cuja resposta só está no doc volta ancorada; `trace` contém `"rag: N trechos recuperados"`.
- [ ] **Busca semântica:** `/search` retorna `hits` ordenados por relevância.
- [ ] **Discovery:** Eureka lista `MEMORY-SERVICE` e `RETRIEVAL-SERVICE` `UP`; resolução por `lb://`.
- [ ] **Resiliência:** com memory/retrieval fora, `/chat` ainda responde (fallback); breaker abre.
- [ ] **Back-compat:** `/chat` sem `conversationId` continua funcionando (stateless).
- [ ] **Build verde:** `mvn package` em `memory-service` e `agent-service`; `retrieval-service` sobe (`uv run uvicorn`).
- [ ] Docs + ADRs 0007/0008/0009.

## Riscos / decisões em aberto

- **R1 — Eureka client em Python.** `py-eureka-client` pode ter atrito no Windows. Mitigação: fallback URL fixa (`RETRIEVAL_URL`), precedente do `llm-gateway`. ADR 0008.
- **R2 — Dimensão/coleção ChromaDB.** `embeddinggemma:300m` = 768 dims; coleção presa à 1ª dimensão. Uma coleção (`knowledge`), um único modelo de embeddings. Confirmar na tarefa 1.
- **R3 — Janela de contexto do modelo local.** Capar histórico (`memory.history-limit`, ex.: 20) e `rag.top-k` (ex.: 4). Externalizado.
- **R4 — `RestClient` load-balanced.** `llmRestClient` não é `@LoadBalanced`; builder separado para `lb://`. Não alterar o client do LLM.
- **R5 — Persistir o quê.** Só `user` + `assistant` final no longo prazo (turno limpo); `tool` intermediárias efêmeras.
- **R6 — `conversationId` no frontend.** Tarefa 11 (bônus); se não feita, validar memória por `curl` com id fixo.
- **R7 — Ingestão síncrona.** `/ingest` bloqueia; vira assíncrono (RabbitMQ) na Entrega 4.
- **R8 — Embeddings via Ollama no LiteLLM.** Confirmar `/v1/embeddings` (`data[].embedding`) na tarefa 1.

## Verificação (passo a passo executável)

**1) Subir a infra (sem nuvem):**

```bash
docker compose -f infra/docker-compose.infra.yaml up -d   # redis 6379, postgres 5432, chroma 8000
# ou docker run: redis:7-alpine, postgres:16-alpine (POSTGRES_DB=memory), chromadb/chroma
```

**2) Subir serviços (ordem):** `name-server` → infra → `llm-gateway` → `memory-service` → `retrieval-service` → `agent-service` → `api-gateway`.

```powershell
cd memory-service    ; .\mvnw.cmd spring-boot:run          # 8082
cd retrieval-service ; uv run uvicorn app.main:app --port 8083
```

**3) Eureka:** `http://localhost:8761` → `MEMORY-SERVICE` e `RETRIEVAL-SERVICE` `UP`.

**4) Ingerir doc + buscar:**

```bash
curl http://localhost:8083/ingest -H "Content-Type: application/json" -d "{\"docId\":\"doc1\",\"projectId\":\"p1\",\"text\":\"O codinome do projeto interno da Nubo e Andromeda. O prazo final e 03/07/2026.\"}"
curl http://localhost:8083/search -H "Content-Type: application/json" -d "{\"query\":\"Qual o codinome do projeto?\",\"topK\":3}"
```

**5) Memória ponta-a-ponta (mesmo `conversationId`):**

```bash
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-demo\",\"message\":\"Meu nome e Humberto. Lembre-se disso.\"}"
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-demo\",\"message\":\"Qual e o meu nome?\"}"
```

**6) RAG no `/chat`:**

```bash
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-demo\",\"message\":\"Qual o codinome do projeto interno da Nubo?\"}"
# Esperado: reply menciona 'Andromeda'; trace contem "rag: N trechos recuperados"
```

**7) Conferir os dois níveis:**

```bash
docker exec -it postgres psql -U postgres -d memory -c "SELECT role, left(content,40) FROM conversation_message WHERE conversation_id='c-demo' ORDER BY id;"
docker exec -it redis redis-cli LRANGE conv:c-demo:messages 0 -1
```

**8) Resiliência (opcional):** parar Redis → `/chat` ainda responde (Postgres); parar `retrieval-service` → responde sem RAG, sem 5xx.

## Ordem de execução e paralelismo

1. **Tarefa 1** primeiro (destrava o resto).
2. **Tarefa 2** (infra) independente, em paralelo.
3. **Dois fluxos em paralelo após a 1:** memory `3→4`; retrieval `5→{6,7}`.
4. **agent-service:** `8` cedo; depois `9` → `10`.
5. **`11`** (frontend) após a 8. **`12`** (docs) após 2–10. **`13`** (verificação) por último.

**Caminho crítico:** 1 → (4 ‖ 6/7) → 9 → 10 → 13.
