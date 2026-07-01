# Plano — Bônus: Frontend (cliente web)

**Status:** Em andamento · **Atualizado:** 2026-06-28

## Objetivo

Cliente web estilo claude.ai para a Plataforma de Agentes — facilita teste/uso e a
demonstração em vídeo (Entrega 8). Fora do escopo mínimo da spec (os 7 microsserviços), mas
consome a mesma API (`POST /chat` via gateway).

## Stack

Vite + React 19 + TypeScript + Tailwind v4 + Radix primitives + componentes estilo shadcn
(escritos à mão). `react-markdown` + `remark-gfm`. Fontes locais (@fontsource). Estado em
Context + useReducer com persistência em **localStorage** (sem backend novo). Proxy de dev
`/api` → `http://localhost:8080` (gateway), com `rewrite` removendo `/api` (a rota do gateway é
`Path=/chat/**`).

## Feito

- App shell: sidebar colapsável (Nova conversa, busca, Projetos, Conversas agrupadas por data),
  top bar (título + opções da conversa), rodapé (configurações, toggle tema, modelo em exibição).
- **Controles do agente no input do chat** (composer, estilo Claude Code): **modelo**, **esforço**
  (Rápido/Equilibrado/Profundo) e **raciocínio (thinking)** — enviados ao `/chat` e que mudam o
  comportamento de verdade (orçamento de iterações + temperatura + raciocínio passo a passo no
  `trace`). Fonte única de seleção (removidos da top bar e das Configurações). ADR 0015.
- **Aba Modelos (Configurações):** gerência de modelos do Ollama via `/models` (proxy no
  agent-service): **listar** instalados, **baixar** com **barra de progresso** (%, baixado/total,
  velocidade, ETA, cancelar) lendo o stream NDJSON, **remover**, copiar comando CLI, catálogo curado
  + campo livre + link ollama.com/search. Verificado ao vivo (embeddinggemma:300m baixou pela UI).
  Abas das Configurações em uma linha rolável (seta + fade). ADR 0016.
- **Dark mode** (claro / escuro / sistema) com anti-FOUC e `prefers-reduced-motion`.
- Múltiplas conversas + projetos persistidos; renomear/excluir/mover; busca.
- Configurações (modal com abas Geral / Personalização / Infraestrutura / Sobre — a seleção de
  modelo saiu daqui e foi para o composer).
- Chat: composer (Enter envia, Shift+Enter quebra), mensagens usuário/assistente, **markdown**,
  estado vazio serif.
- **Assinatura — timeline do ciclo agêntico**: render de `trace` como
  raciocínio → ação → observação (ferramenta, args, resultado, resposta final).
- Integração verificada **ao vivo**: chat ponta-a-ponta com LLM real (Ollama via gateway),
  incluindo tool calling (calculadora) renderizado na timeline.

## Lote seguinte — concluído (pedido do usuário)

### Projetos (à la Claude Projects)
- [x] **Arquivos / conhecimento do projeto** — upload, listagem e remoção (barra de capacidade).
  UI + localStorage; uso real (RAG) via `retrieval-service`.
- [x] **Memória** — seção de memória do projeto (notas/fatos persistentes).
- [x] **Instruções** — seção de instruções custom do projeto.

### Mensagens / chat
- [x] **Renderização LaTeX** (KaTeX via `remark-math` + `rehype-katex`).
- [x] **Blocos de código** com realce de sintaxe + botão **copiar**.
- [x] **Copiar resposta** (botão por mensagem do agente).
- [x] **Editar mensagem** do usuário + **regenerar** resposta do agente.
- [x] **Anexar arquivo no chat** (clipe no composer).
- [x] **Controles do agente no composer** — modelo · esforço · raciocínio (ADR 0015).

## Notas / dependências de backend

- Upload de arquivos é **UI + localStorage** agora; o **uso real (RAG)** liga no
  `retrieval-service` da **Entrega 3** (ingestão + busca semântica). Documentar o contrato
  quando a Entrega 3 existir.
- "Memória" do projeto no frontend é local; a memória de conversa do backend é o
  `memory-service` (Entrega 3) — integrar depois.
- **Controles do agente ligados ao `/chat`** (não cosméticos): `store.runAgent` → `lib/api`
  `sendChat` envia `model` (mapeado para o modelo lógico do `llm-gateway`), `effort` e `thinking`.
  O backend trata `effort` (orçamento de iterações + temperatura, `AgentLoop.effortPolicy`) e
  `thinking` (raciocínio passo a passo no system prompt); ambos no `trace`. Detalhe no ADR 0015.

## Verificação

`npm run build` passa; com a plataforma no ar (name-server + agent-service + api-gateway +
llm-gateway), o chat responde via `http://localhost:5173` e a timeline mostra o ciclo agêntico.
Controles do composer verificados ao vivo (Docker Compose, `llama3.1`): **Profundo + Pensar** →
`trace` com `orcamento 10 iteracoes, temperatura 0.3` + `modo raciocinio: ligado`, resposta em
`Raciocinio:`/`Resposta:` e `calculator` ancorando `(12 + 8) * 3 → 60`.

**No compose:** `frontend/Dockerfile` multi-stage (build Vite no Node → nginx serve o `dist/`) +
`nginx.conf` (proxy `/api`→api-gateway, `proxy_buffering off` p/ streaming) + `.dockerignore`;
serviço `frontend` no `docker-compose.yaml` (porta 5173). Assim o **site inteiro** sobe com
`docker compose up`. Verificado ao vivo: 14 containers `Up`, `http://localhost:5173` → 200,
`/api/services` via nginx → 200. `npm run dev` segue disponível para hot-reload da UI.
