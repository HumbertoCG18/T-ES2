# retrieval-service

Busca semântica em documentos (**RAG**) da plataforma — Entrega 3.

- **Stack:** Python (FastAPI) + **ChromaDB** (container, `HttpClient`) + embeddings via **llm-gateway**.
- **Porta:** 8083. **Nome lógico (Eureka):** `retrieval-service`.
- **Embeddings:** sempre via `llm-gateway` (`POST /v1/embeddings`, modelo lógico `embeddings` =
  `embeddinggemma:300m`, 768 dims). **Nunca** provedor de nuvem.

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

| Método | Rota                  | Descrição                                    | Entrega |
|--------|-----------------------|----------------------------------------------|---------|
| GET    | `/health`             | liveness                                     | T5 ✅   |
| POST   | `/ingest`             | `{docId, projectId, text, metadata?}` → chunk+embed+upsert | T6 |
| POST   | `/search`             | `{query, topK?, projectId?}` → embed+query   | T6      |
| DELETE | `/documents/{docId}`  | remove chunks do doc (opcional)              | T6      |

## Config (env)

`LLM_BASE_URL` · `EMBEDDINGS_MODEL` · `CHROMA_HOST` · `CHROMA_PORT` · `CHROMA_COLLECTION` ·
`CHUNK_SIZE` · `CHUNK_OVERLAP` · `DEFAULT_TOP_K` · `SERVICE_PORT` · `EUREKA_URL` · `EUREKA_ENABLED`.

> `EUREKA_ENABLED=false` desliga o registro no Eureka e usa-se a URL fixa no agent-service
> (`RETRIEVAL_URL`); precedente do `llm-gateway` (ver R1/ADR 0008).
