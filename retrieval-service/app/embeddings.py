"""Cliente de embeddings — sempre via llm-gateway (LiteLLM, OpenAI-compatível).

POST /v1/embeddings  body {model, input}  ->  {data: [{embedding, index}], ...}
Modelo lógico 'embeddings' = embeddinggemma:300m (768 dims). Nunca provedor de nuvem.
"""

import httpx

from app.config import settings


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeda uma lista de textos; preserva a ordem (reordena por 'index')."""
    if not texts:
        return []
    payload = {"model": settings.embeddings_model, "input": texts}
    async with httpx.AsyncClient(timeout=settings.embeddings_timeout) as client:
        resp = await client.post(f"{settings.llm_base_url}/v1/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()
    items = sorted(data["data"], key=lambda d: d.get("index", 0))
    return [item["embedding"] for item in items]


async def embed_query(text: str) -> list[float]:
    vectors = await embed_texts([text])
    return vectors[0]
