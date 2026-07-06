# retrieval-service

Busca semântica em documentos (**RAG**) da plataforma.

- **Stack:** Python (FastAPI) + **ChromaDB** (`HttpClient`) + embeddings via **llm-gateway**.
- **Porta:** 8083. **Nome lógico (Eureka):** `retrieval-service`.
- **Embeddings:** sempre via `llm-gateway` (`POST /v1/embeddings`, modelo lógico `embeddings` =
  `embeddinggemma:300m`, 768 dims). **Nunca** provedor de nuvem.
- Também **consome a fila de ingestão assíncrona** `document.ingest` (RabbitMQ, Entrega 4) e
  **exporta tracing** OpenTelemetry → Jaeger (Entrega 6). Tem `Dockerfile` e roda no
  `docker-compose.yaml` da raiz (Entrega 5).

## Rodar (uv)

Pré-requisitos: infra de pé (`infra/docker-compose.infra.yaml` → ChromaDB na 8000),
`llm-gateway` na 4000 e Ollama com `embeddinggemma:300m`.

```bash
cd retrieval-service
uv sync                                       # instala deps
uv run uvicorn app.main:app --port 8083       # (--reload em dev)
```

Smoke: `curl http://localhost:8083/health` → `{"status":"UP","service":"retrieval-service"}`.

## Endpoints (contratos)

| Método | Rota                  | Descrição                                    |
|--------|-----------------------|----------------------------------------------|
| GET    | `/health`             | liveness                                     |
| POST   | `/ingest`             | `{docId, projectId, text, metadata?}` → chunk+embed+upsert |
| POST   | `/search`             | `{query, topK?, projectId?}` → embed+query   |
| DELETE | `/documents/{docId}`  | remove chunks do doc                         |

## Config (env)

`LLM_BASE_URL` · `EMBEDDINGS_MODEL` · `CHROMA_HOST` · `CHROMA_PORT` · `CHROMA_COLLECTION` ·
`CHUNK_SIZE` · `CHUNK_OVERLAP` · `DEFAULT_TOP_K` · `SERVICE_PORT` · `EUREKA_URL` · `EUREKA_ENABLED`.

> `EUREKA_ENABLED=false` desliga o registro no Eureka e usa-se a URL fixa no agent-service
> (`RETRIEVAL_URL`); precedente do `llm-gateway` (ver R1/ADR 0008).
