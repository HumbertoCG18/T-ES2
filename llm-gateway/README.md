# llm-gateway

Proxy unificado para modelos de linguagem locais (LiteLLM + Ollama). Expõe uma API
OpenAI-compatível em `http://localhost:4000`, abstraindo o provedor de LLM para os demais
microsserviços.

## Pré-requisitos

- [Ollama](https://ollama.ai) rodando localmente (`http://localhost:11434`).
- Modelo de chat baixado: `ollama pull llama3.1` (ou `gemma3:4b` para algo mais leve).
- [uv](https://docs.astral.sh/uv/) para gerenciar o ambiente Python.

## Executar (local, sem container)

```bash
# 1. Garanta que o Ollama está no ar
ollama serve            # (já roda como serviço no Windows, em geral)
ollama list             # confirme que llama3.1 está presente

# 2. Suba o gateway
cd llm-gateway
export OLLAMA_BASE_URL=http://localhost:11434    # PowerShell: $env:OLLAMA_BASE_URL="http://localhost:11434"
uv run litellm --config config.yaml --port 4000
```

## Testar

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"chat","messages":[{"role":"user","content":"Diga ola em uma palavra"}]}'
```

## Modelos configurados

| `model_name`  | Backend Ollama          | Uso                                  |
|---------------|-------------------------|--------------------------------------|
| `chat`        | `llama3.1:latest`       | Agente — tool calling confiável      |
| `chat-light`  | `gemma3:4b`             | Alternativa leve (4 GB VRAM)         |
| `embeddings`  | `embeddinggemma:300m`   | RAG / retrieval-service (Entrega 3)  |

> Não aponte para modelos `*-cloud` do Ollama — violam a restrição de execução local sem nuvem.
