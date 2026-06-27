"""Indexação de documentos (chunk + embed + upsert no ChromaDB).

Lógica única reusada pelo endpoint síncrono POST /ingest e pelo consumer da fila
document.ingest (Entrega 4). Retorna o número de chunks indexados.
"""

from typing import Any, Optional

from fastapi.concurrency import run_in_threadpool

from app import chroma, chunking, embeddings
from app.config import settings


async def index_document(
    doc_id: str,
    text: str,
    project_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> int:
    chunks = chunking.chunk_text(text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        return 0

    vectors = await embeddings.embed_texts(chunks)

    ids = [f"{doc_id}:{i}" for i in range(len(chunks))]
    metadatas = []
    for i in range(len(chunks)):
        md: dict = dict(metadata or {})
        md["doc_id"] = doc_id
        md["chunk_index"] = i
        if project_id is not None:
            md["project_id"] = project_id
        metadatas.append(md)

    await run_in_threadpool(chroma.upsert, ids, chunks, vectors, metadatas)
    return len(chunks)
