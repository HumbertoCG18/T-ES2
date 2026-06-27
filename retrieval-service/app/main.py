"""retrieval-service — API de RAG (ingestão + busca semântica).

Endpoints: /health, /ingest, /search, /documents/{docId}.
Registra-se no Eureka no startup (lifespan) e desregistra no shutdown.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import chroma, chunking, embeddings, eureka
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
    yield
    await eureka.deregister()


app = FastAPI(title="retrieval-service", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "UP", "service": settings.service_name}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest) -> IngestResponse:
    chunks = chunking.chunk_text(req.text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        raise HTTPException(status_code=400, detail="texto vazio")

    vectors = await embeddings.embed_texts(chunks)

    ids = [f"{req.docId}:{i}" for i in range(len(chunks))]
    metadatas = []
    for i in range(len(chunks)):
        md: dict = dict(req.metadata or {})
        md["doc_id"] = req.docId
        md["chunk_index"] = i
        if req.projectId is not None:
            md["project_id"] = req.projectId
        metadatas.append(md)

    await run_in_threadpool(chroma.upsert, ids, chunks, vectors, metadatas)
    return IngestResponse(docId=req.docId, chunksIndexed=len(chunks))


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
