# Plano — Bônus: Frontend (cliente web)

**Status:** Em andamento · **Atualizado:** 2026-06-27

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
  top bar (seletor de modelo), rodapé (configurações, toggle tema, modelo).
- **Dark mode** (claro / escuro / sistema) com anti-FOUC e `prefers-reduced-motion`.
- Múltiplas conversas + projetos persistidos; renomear/excluir/mover; busca.
- Configurações (modal com abas Geral / Modelo / Sobre).
- Chat: composer (Enter envia, Shift+Enter quebra), mensagens usuário/assistente, **markdown**,
  estado vazio serif.
- **Assinatura — timeline do ciclo agêntico**: render de `trace` como
  raciocínio → ação → observação (ferramenta, args, resultado, resposta final).
- Integração verificada **ao vivo**: chat ponta-a-ponta com LLM real (Ollama via gateway),
  incluindo tool calling (calculadora) renderizado na timeline.

## A fazer (próximo lote — pedido do usuário)

### Projetos (à la Claude Projects)
- [ ] **Arquivos / conhecimento do projeto** — upload, listagem e remoção de arquivos (a
  "barra/capacidade de arquivos" do projeto). UI + localStorage por ora.
- [ ] **Memória** — seção de memória do projeto (notas/fatos persistentes).
- [ ] **Instruções** — seção de instruções custom do projeto (expandir o que já existe).

### Mensagens / chat
- [ ] **Renderização LaTeX** (KaTeX via `remark-math` + `rehype-katex`).
- [ ] **Blocos de código** com realce de sintaxe + botão **copiar**.
- [ ] **Copiar resposta** (botão por mensagem do agente).
- [ ] **Editar mensagem** do usuário + **regenerar** resposta do agente.
- [ ] **Anexar arquivo no chat** (clipe no composer).

## Notas / dependências de backend

- Upload de arquivos é **UI + localStorage** agora; o **uso real (RAG)** liga no
  `retrieval-service` da **Entrega 3** (ingestão + busca semântica). Documentar o contrato
  quando a Entrega 3 existir.
- "Memória" do projeto no frontend é local; a memória de conversa do backend é o
  `memory-service` (Entrega 3) — integrar depois.
- Seletor de modelo ainda é **cosmético**: a API `/chat` não recebe modelo (TODO no backend
  para repassar ao `llm-gateway`).

## Verificação

`npm run build` passa; com a plataforma no ar (name-server + agent-service + api-gateway +
llm-gateway), o chat responde via `http://localhost:5173` e a timeline mostra o ciclo agêntico.
