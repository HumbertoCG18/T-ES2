# ADR 0003 — LLM local via Ollama atrás do LiteLLM gateway

**Status:** Aceito · **Data:** 2026-06-26

## Contexto

A spec é categórica: "a execução local não deve depender de recursos de nuvem". O `llm-gateway`
deve abstrair o provedor de LLM dos demais serviços. Hardware local: RTX 4050 (4 GB VRAM),
32 GB RAM.

## Decisão

- **Ollama** serve modelos de linguagem locais; **LiteLLM** atua como proxy expondo uma API
  **OpenAI-compatível** (`/v1/chat/completions`), isolando o provedor.
- Modelo padrão do agente: **`llama3.1:latest`** (8B) — tool calling confiável.
- Alternativa leve: **`gemma3:4b`** (cabe nos 4 GB de VRAM).
- Embeddings (RAG, Entrega 3): **`embeddinggemma:300m`**.
- **Proibido** usar modelos `*-cloud` do Ollama — violam a restrição de execução local.

## Consequências

**Prós**
- Plataforma roda 100% offline; custo zero de inferência.
- Trocar de modelo/provedor é mudança de config no gateway, sem tocar nos serviços.

**Contras / trade-offs**
- Qualidade e velocidade limitadas pelo hardware; modelos grandes (8B) extrapolam a VRAM e
  caem parcialmente para CPU/RAM.
- Tool calling depende do suporte do modelo — daí o `llama3.1` como padrão e o `gemma3:4b`
  apenas como fallback leve.
