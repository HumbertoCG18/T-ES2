# Imagem do retrieval-service (FastAPI + ChromaDB client). Python slim + uv.
FROM python:3.11-slim
WORKDIR /app

# uv a partir da imagem oficial.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Cache de dependências.
COPY pyproject.toml .
RUN uv sync

COPY app ./app

EXPOSE 8083
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
