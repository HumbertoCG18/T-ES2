# frontend — cliente web (bônus)

Cliente web estilo **claude.ai** para a Plataforma de Agentes. Consome o `POST /chat` via
`api-gateway`. É **bônus** (fora dos 7 microsserviços da spec) — serve para a demonstração.

- **Stack:** Vite + React + TypeScript + Tailwind v4 + componentes shadcn-like.
- **Porta:** 5173. Fala com o backend pelo proxy de dev `/api` → `http://localhost:8080` (gateway).

## Rodar (com a plataforma no ar)

```bash
cd frontend
npm install     # primeira vez
npm run dev     # http://localhost:5173
```

> Para o chat funcionar, a plataforma precisa estar de pé (ver [`../docs/GUIA-DO-SISTEMA.md`](../docs/GUIA-DO-SISTEMA.md)):
> `docker compose up -d` na raiz **ou** os serviços em modo dev. Sem os modelos do Ollama, o `/chat`
> responde com o fallback do circuit breaker.

## O que tem

App shell com views **Conversas / Projetos / Capacidades**; chat com markdown/LaTeX/**blocos de
código**, **timeline** do ciclo agêntico (Pensamento vs passos), **citações** (fontes do RAG),
**citar trecho**, editar/regenerar/copiar, anexos. **Controles do agente no input do chat —
modelo · esforço (Rápido/Equilibrado/Profundo) · raciocínio (thinking) — estilo Claude Code,
enviados ao `/chat`** e que mudam o comportamento de verdade (orçamento de iterações + temperatura
+ raciocínio passo a passo no `trace`; ADR 0015). Projetos com instruções/memória/arquivos
(barra de capacidade). Configurações (tema, fonte, instruções) + aba **Infraestrutura** (mostra as
Entregas 4–7 com links para RabbitMQ/Jaeger). Toggles de memória/RAG por conversa, ver/limpar
memória, saúde dos serviços ao vivo. Logomark próprio.

## Comandos

```bash
npm run dev        # servidor de dev (HMR)
npm run build      # build de produção (dist/)
npx tsc --noEmit   # checagem de tipos (roda no CI)
```

Estrutura: `src/components/` (chat, sidebar, project, settings, capabilities, ui),
`src/store/` (estado via useReducer + localStorage), `src/lib/` (api, helpers). Status e plano em
[`../docs/plan/B-frontend.md`](../docs/plan/B-frontend.md). Decisão de stack no ADR 0006.
