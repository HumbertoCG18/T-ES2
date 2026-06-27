"""retrieval-service — API de RAG (ingestão + busca semântica).

Endpoints: /health, /ingest, /search, /documents/{docId}.
Registra-se no Eureka no startup (lifespan) e desregistra no shutdown.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import chroma, consumer, embeddings, eureka, rag_index
from app.config import settings
from app.models import (
    Hit,
    IngestRequest,
    IngestResponse,
    SearchRequest,
    SearchResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await eureka.register()
    await consumer.start()       # consumer da fila document.ingest (Entrega 4)
    yield
    await consumer.stop()
    await eureka.deregister()


app = FastAPI(title="retrieval-service", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "UP", "service": settings.service_name}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest) -> IngestResponse:
    # Ingestão síncrona direta; a fila document.ingest usa a mesma lógica (rag_index).
    n = await rag_index.index_document(req.docId, req.text, req.projectId, req.metadata)
    if n == 0:
        raise HTTPException(status_code=400, detail="texto vazio")
    return IngestResponse(docId=req.docId, chunksIndexed=n)


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest) -> SearchResponse:
    qvec = await embeddings.embed_query(req.query)
    where = {"project_id": req.projectId} if req.projectId else None
    res = await run_in_threadpool(chroma.query, [qvec], req.topK, where)

    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    hits = [
        Hit(
            text=doc,
            score=round(1.0 - dist, 4) if dist is not None else 0.0,  # cosseno: 1 - dist
            metadata=meta or {},
        )
        for doc, meta, dist in zip(docs, metas, dists)
    ]
    return SearchResponse(hits=hits)


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str) -> dict:
    await run_in_threadpool(chroma.delete_doc, doc_id)
    return {"docId": doc_id, "deleted": True}
