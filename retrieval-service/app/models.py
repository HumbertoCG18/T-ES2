"""Modelos de request/response (pydantic) do retrieval-service."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    docId: str
    projectId: Optional[str] = None
    text: str
    metadata: Optional[dict[str, Any]] = None


class IngestResponse(BaseModel):
    docId: str
    chunksIndexed: int


class SearchRequest(BaseModel):
    query: str
    topK: int = Field(default=4, ge=1, le=50)
    projectId: Optional[str] = None


class Hit(BaseModel):
    text: str
    score: float           # similaridade de cosseno (maior = mais relevante)
    metadata: dict[str, Any]


class SearchResponse(BaseModel):
    hits: list[Hit]
