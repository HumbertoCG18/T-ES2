# ADR 0006 — Stack do frontend: Vite + React + Tailwind + shadcn (localStorage)

**Status:** Aceito · **Data:** 2026-06-27

## Contexto

O ADR 0004 aceitou um frontend como bônus de demonstração, deixando a stack em aberto. Ao
construir, foi preciso decidir framework, biblioteca de UI, integração com o backend e
persistência. O cliente cresceu de um chat de página única para um app shell estilo claude.ai
(sidebar, projetos, configurações, dark mode).

## Decisão

- **Vite + React 19 + TypeScript** — SPA leve; não há necessidade de SSR para um cliente de
  chat. Mais simples e rápido que Next.js para este caso.
- **Tailwind CSS v4** + **componentes estilo shadcn escritos à mão** sobre **Radix primitives**
  (dialog, dropdown-menu, tooltip, switch, tabs, scroll-area). Evita o CLI interativo do shadcn
  (que trava o shell não-interativo) e mantém acessibilidade.
- **Persistência em `localStorage`** (conversas, projetos, settings) — sem backend novo. O uso
  real de arquivos/memória de projeto liga depois no `retrieval-service`/`memory-service`
  (Entrega 3).
- **Integração:** `POST /chat` via gateway; proxy de dev `/api` → `http://localhost:8080` com
  **`rewrite` removendo `/api`** (a rota do gateway é `Path=/chat/**`; sem o rewrite, `/api/chat`
  retornava 404).

## Consequências

**Prós**
- Build rápido; bundle único; itera bem com dev server + HMR.
- Acessibilidade via Radix; tema claro/escuro; assinatura própria (timeline do ciclo agêntico).

**Contras / trade-offs**
- Sem persistência de servidor: dados vivem no navegador. Aceitável para demo.
- Seletor de modelo é cosmético até a API `/chat` aceitar o parâmetro de modelo (TODO backend).
- Em produção (sem dev server do Vite) o proxy não existe — seria preciso CORS no gateway ou
  servir o frontend pela mesma origem. Fora do escopo atual.
