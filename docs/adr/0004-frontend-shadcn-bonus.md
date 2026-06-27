# ADR 0004 — Frontend shadcn como bônus de demonstração

**Status:** Aceito · **Data:** 2026-06-26

## Contexto

A spec não exige interface gráfica — o "Cliente (HTTP)" do diagrama é qualquer chamador
(curl/Postman). Porém a Entrega 8 inclui um **vídeo de demonstração**, e uma UI de chat torna o
ciclo agêntico (incluindo o `trace` de ferramentas) muito mais claro de mostrar.

## Decisão

Construir um **frontend mínimo** com **shadcn/ui** (React) consumindo `POST /chat`. Tratado
como **bônus fora do escopo de nota** — não compete com os 7 microsserviços.

## Consequências

**Prós**
- Demonstração em vídeo mais clara e vendável.
- Skills `shadcn` / `frontend-design` já disponíveis em `.agents/`.

**Contras / trade-offs**
- Risco de consumir tempo do backend. Mitigação: escopo travado em **uma página de chat**;
  só avançar após o backend essencial estar estável.
- Decisão de stack (Next.js vs Vite + React) adiada para o momento da implementação.
