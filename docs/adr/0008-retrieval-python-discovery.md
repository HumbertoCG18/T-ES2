# ADR 0008 — retrieval-service em Python (FastAPI) + discovery via py-eureka-client com fallback de URL fixa

**Status:** Aceito · **Data:** 2026-06-27

## Contexto

A spec coloca o `retrieval-service` (RAG) como serviço Python e o lista como "Eureka client". O
ecossistema de RAG (ChromaDB, embeddings) é nativamente Python. Mas o Eureka é mundo Spring/Java;
registrar um serviço Python no Eureka tem menos suporte e pode ter atrito no Windows.

## Decisão

- **Stack:** Python **FastAPI** + **ChromaDB** (container servidor via `HttpClient`) + cliente de
  embeddings (`httpx` → `llm-gateway`). Gerência de deps por **uv**.
- **Discovery (primário):** registrar no Eureka com **`py-eureka-client`** no *lifespan* do FastAPI
  (`init_async` no startup, `stop_async` no shutdown). Assim o `agent-service` resolve por
  **`lb://retrieval-service`**, uniforme com os serviços Spring.
- **Contingência (fallback):** `RetrievalProperties.base-url` aceita tanto `lb://retrieval-service`
  quanto `http://host:porta`. Se o registro Python falhar, basta `RETRIEVAL_URL=http://localhost:8083`
  e `EUREKA_ENABLED=false` — **precedente no repo**: o `llm-gateway` (também Python) não se registra
  e é acessado por URL fixa. O registro é tolerante a falha: erro no Eureka não derruba o serviço.
- **ChromaDB como container servidor** (imagem `chromadb/chroma:1.5.3`, porta 8000), `HttpClient`,
  uma única coleção `knowledge` (a dimensão é fixada pelo 1º embedding e é imutável → um modelo só).
- **Embeddings sempre via `llm-gateway`** (`POST /v1/embeddings`, modelo lógico `embeddings` =
  `embeddinggemma:300m`, 768 dims). Quem embeda é o `retrieval-service`, não o `agent-service`.

## Consequências

**Prós**
- Cumpre o texto da spec (retrieval Python + Eureka client) com **uma** dependência no próprio processo.
- Verificado ao vivo no Windows: `RETRIEVAL-SERVICE UP` no Eureka, resolução `lb://` funcionando.
- A troca para URL fixa é só de configuração — risco R1 mitigado sem mudança de código.

**Contras / trade-offs**
- Dois mecanismos de discovery na plataforma (Spring eureka-client e py-eureka-client) — custo de
  manter dois caminhos, compensado por manter o retrieval em Python.
- No agent-service, o `RestClient` load-balanced trata o host como serviceId; por isso a URL fixa
  **não** passa pelo client `lb://` (escolhe-se o builder conforme o esquema do `base-url`).
- `EUREKA_ENABLED` registra com IP fixo (dev). Em K8s/Compose (Entrega 5) isso é re-externalizado.
