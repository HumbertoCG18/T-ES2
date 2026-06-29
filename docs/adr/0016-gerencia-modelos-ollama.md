# ADR 0016 — Gerência de modelos do Ollama pela UI (proxy via agent-service) + download com progresso

**Status:** Aceito · **Data:** 2026-06-28

## Contexto

O usuário precisa **baixar/listar/remover modelos do Ollama** sem abrir um terminal (ex.: trocar
`llama3.1` por um modelo mais leve, ou puxar `embeddinggemma:300m` para o RAG). Restrições:

- O **browser não fala direto com o Ollama**: CORS, o Ollama (11434) não é o ponto de entrada e o
  princípio da plataforma é **entrada única pelo `api-gateway`**.
- O **`ollama.com/search` não tem API pública** — scraping é frágil e dá CORS.
- O **`pull` do Ollama exige internet** (registry `registry.ollama.ai`). Isso é **setup**, fora do
  caminho de execução do `/chat` (que continua 100% local) — não viola "local sem nuvem".

## Decisão

- **Endpoints `/models` no `agent-service`** (proxy do Ollama), expostos via gateway:
  - `GET /models` → lista instalados (proxy de `GET /api/tags`).
  - `POST /models/pull` `{model}` → **baixa com progresso em streaming** (`StreamingResponseBody`,
    `application/x-ndjson`): repassa o NDJSON do Ollama (`{status, digest, total, completed}`) linha
    a linha, com flush por bloco.
  - `DELETE /models/{name}` → remove (proxy de `DELETE /api/delete`).
- **Rota `/models/**` → `lb://agent-service`** no `api-gateway` (sem rate limit). O frontend chama
  `/api/models` (proxy de dev → gateway). Mantém a entrada única; o browser nunca toca o Ollama.
- **Config:** `OLLAMA_BASE_URL` no `agent-service` (Compose `http://ollama:11434`; dev
  `http://localhost:11434`); `RestClient` dedicado **sem read timeout** (pull leva minutos);
  `spring.mvc.async.request-timeout=1h` (o async do `StreamingResponseBody` morreria em ~30s).
- **Barra de progresso real no cliente:** o frontend lê o stream via `fetch` + `ReadableStream`,
  parseia o NDJSON e calcula **porcentagem, bytes baixados/total, velocidade e ETA** (Δbytes/Δtempo
  suavizado). Cancelável via `AbortSignal`.
- **Catálogo curado + campo livre:** como não há API do `ollama.com`, a aba lista um **catálogo
  curado** (`OLLAMA_CATALOG`, ~7 modelos: os de `MODELS` + o de embeddings do RAG) com **comando CLI
  copiável** (`docker compose exec ollama ollama pull <tag>`), um **campo de busca por nome** (puxa
  qualquer tag) e um link **"catálogo completo" → ollama.com/search**.
- **Aba "Modelos" nas Configurações:** instalados (tamanho · params · quant, com remover), catálogo
  (Baixar + copiar comando), barra de progresso e cancelar.

## Consequências

**Prós**
- Gerência de modelos pela UI, sem terminal; entrada única preservada (browser → gateway →
  agent-service → Ollama).
- Progresso **real e demonstrável**. Verificado ao vivo (Docker Compose): `embeddinggemma:300m`
  baixou pela UI com barra (`%`, `MB/GB`, `MB/s`, `ETA`) e ao concluir a lista de instalados
  atualizou sozinha; `llama3.2:3b` mostrou `7.7 MB/s · ETA 3min`; **cancelar** aborta o stream.

**Contras / trade-offs**
- **Baixar exige internet** (setup) — declarado na própria aba; o `/chat` segue 100% local.
- **Catálogo curado é manutenção manual** (sem API do ollama.com); mitigado pelo campo livre por
  nome + link para o catálogo completo.
- **`StreamingResponseBody` segura uma thread do Tomcat** durante o pull; aceitável (endpoint de
  administração, baixa concorrência) e limitado pelo timeout de 1h.
- Contrato do gateway cresceu (rota `/models/**`).
- **Nota técnica:** velocidade/ETA são calculados no cliente; a computação ficou **fora** do updater
  do `setState` — mutar a ref de medição dentro do updater quebra no StrictMode do React 19 (o
  updater roda 2×, corrompendo o delta e zerando a velocidade).
