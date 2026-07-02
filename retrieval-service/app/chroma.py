"""Cliente ChromaDB (container servidor via HttpClient).

Uma única coleção ('knowledge') — a dimensão é fixada pelo 1º embedding e imutável,
então um único modelo de embeddings serve a coleção toda. Espaço = cosseno.
Os embeddings são pré-computados (embedding_function=None): quem embeda é este serviço.
"""

import threading
from typing import Any, Optional

import chromadb

from app.config import settings

_collection = None
_lock = threading.Lock()


def get_collection():
    # Double-checked locking: get_collection roda no threadpool (run_in_threadpool), então
    # múltiplas threads podem entrar juntas na 1ª chamada e criar vários HttpClient. O lock
    # garante uma única inicialização da coleção.
    global _collection
    if _collection is None:
        with _lock:
            if _collection is None:
                client = chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
                _collection = client.get_or_create_collection(
                    name=settings.chroma_collection,
                    embedding_function=None,
                    metadata={"hnsw:space": "cosine"},
                )
    return _collection


def upsert(ids: list[str], documents: list[str],
           embeddings: list[list[float]], metadatas: list[dict[str, Any]]) -> None:
    get_collection().upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )


def query(query_embeddings: list[list[float]], n_results: int,
          where: Optional[dict[str, Any]] = None) -> dict:
    kwargs: dict[str, Any] = {
        "query_embeddings": query_embeddings,
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where
    return get_collection().query(**kwargs)


def delete_doc(doc_id: str) -> None:
    get_collection().delete(where={"doc_id": doc_id})


def get_by_project(project_id: str, limit: int = 500) -> dict:
    """Todos os chunks de um projeto (p/ o inventário de documentos do agente)."""
    return get_collection().get(
        where={"project_id": project_id},
        limit=limit,
        include=["metadatas", "documents"],
    )
