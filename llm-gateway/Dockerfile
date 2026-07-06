# Imagem do llm-gateway (LiteLLM proxy). Python slim + uv.
FROM python:3.11-slim
WORKDIR /app

# uv (gerenciador de pacotes) a partir da imagem oficial.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Cache de dependências: só o pyproject muda raramente.
COPY pyproject.toml .
RUN uv sync

COPY config.yaml .

ENV OLLAMA_BASE_URL=http://ollama:11434
EXPOSE 4000
CMD ["uv", "run", "litellm", "--config", "config.yaml", "--host", "0.0.0.0", "--port", "4000"]
