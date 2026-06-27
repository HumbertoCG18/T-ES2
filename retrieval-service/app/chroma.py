"""Cliente ChromaDB (container servidor via HttpClient).

Uma única coleção ('knowledge') — a dimensão é fixada pelo 1º embedding e imutável,
então um único modelo de embeddings serve a coleção toda. Espaço = cosseno.
Os embeddings são pré-computados (embedding_function=None): quem embeda é este serviço.
"""

from typing import Any, Optional

import chromadb

from app.config import settings

_collection = None


def get_collection():
    global _collection
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
