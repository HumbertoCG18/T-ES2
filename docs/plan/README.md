# Roteiro de execução — Sub-Agent Driven Development (SADD)

Fonte única de "onde estamos / o que falta / como trabalhamos". Antes de codar qualquer
entrega, cria-se um **plano** (`docs/plan/NN-<nome>.md`); a implementação é decomposta e
delegada a **subagents**; a thread principal integra e verifica.

## Método (ciclo por entrega)

1. **Planejar** — gerar `docs/plan/NN-<nome>.md` a partir de [`_template.md`](_template.md):
   escopo, tarefas, arquivos afetados, critérios de aceite, riscos. (Plan agent / skill
   `writing-plans`.)
2. **Decompor e delegar** — quebrar em tarefas isoladas e mandar para subagents:
   - localizar código → `Explore` / `cavecrew-investigator`
   - edição 1–2 arquivos → `cavecrew-builder`
   - desenho de arquitetura → `Plan`
   - tarefa multi-step isolada → `general-purpose`
3. **Integrar e verificar** — thread principal junta, builda, roda testes/smoke.
4. **Atualizar estado** — marcar status nesta tabela; atualizar `architecture.md` e abrir ADR
   se houver decisão nova.

> Regra: nada de codar entrega sem plano aprovado. Plano pequeno e factível > plano perfeito.

## Status atual (2026-06-27)

**Onde estamos:** Entregas 1 e 2 concluídas e verificadas ao vivo; bônus de frontend com app
shell funcional e chat real ponta-a-ponta. Próxima entrega de spec = **Entrega 3 (Memória e
RAG)** — e é ela que destrava o uso real dos arquivos de Projeto no frontend (RAG).

**Feito (commitado no branch `dev-HCG`):**
- ✅ **Entrega 1** — `agent-service` (ciclo agêntico, `/chat`, calculadora) + `llm-gateway`
  (LiteLLM/Ollama). Commit `bd5c90f`.
- ✅ **Entrega 2** — `name-server` (Eureka), `api-gateway` (Spring Cloud Gateway), circuit
  breaker com fallback. Verificada ao vivo. Commit `b99472d`.
- ✅ **Correção** — Eureka self-preservation desligado em dev (banner "EMERGENCY"). Commit `e431829`.
- 🔨 **Bônus frontend** — Vite + React + Tailwind + shadcn: app shell, chat com markdown/LaTeX/
  código, **timeline do ciclo agêntico**, projetos (instruções/memória/arquivos), editar/
  regenerar, copiar, anexos. Chat **funcionando com LLM real + tool calling**. Commits `ec63edd`,
  `b5a20a1`. (Lote de features concluído; ver `B-frontend.md` para o que falta integrar ao backend.)

**Foco agora:** voltar ao **backend da spec** — **Entrega 3 (Memória e RAG)**, que destrava o
uso real dos arquivos/memória de projeto do frontend. Depois 4–8.

**Falta (spec):** Entregas 3–8 (RAG, mensageria, containers, observabilidade, K8s, relatório).

## Estado das entregas

| # | Entrega | Plano | Status |
|---|---------|-------|--------|
| 1 | Fundação — agent-service + llm-gateway (REST) | — | ✅ Concluída |
| 2 | Infraestrutura — Eureka + api-gateway + circuit breaker | [`02-infraestrutura.md`](02-infraestrutura.md) | ✅ Concluída (verificada ao vivo) |
| 3 | Memória e RAG — memory-service + retrieval-service | [`03-memoria-rag.md`](03-memoria-rag.md) | ✅ Concluída (verificada ao vivo: memória 2 níveis, RAG ancorado 3/3, discovery `lb://`, resiliência, back-compat; frontend passa `conversationId`; ADRs 0007/0008/0009) |
| 4 | Mensageria — RabbitMQ (fluxos assíncronos) | [`04-mensageria.md`](04-mensageria.md) | ✅ Concluída (verificada ao vivo: ingestão async polyglot + telemetria persistida; desacoplamento e resiliência provados; ADR 0010) |
| 5 | Containerização — Dockerfiles + docker-compose | `05-containerizacao.md` | ⬜ A planejar |
| 6 | Observabilidade — OpenTelemetry + Jaeger + CI | `06-observabilidade.md` | ⬜ A planejar |
| 7 | Produção em nuvem — manifests + descrição K8s | `07-nuvem-k8s.md` | ⬜ A planejar |
| 8 | Entrega final — relatório + vídeo + apresentação | `08-entrega-final.md` | ⬜ A planejar |
| T | tool-registry (microsserviço nº 5 da spec) | [`T-tool-registry.md`](T-tool-registry.md) | ✅ Concluído (calculator/datetime/db_query remotos; verificado ao vivo; ADR 0011) |
| B | Bônus — frontend (app shell + demo) | [`B-frontend.md`](B-frontend.md) | 🔨 Em andamento |

## Critérios de aceite (resumo por entrega)

- **2:** serviços registrados no Eureka; acesso via `api-gateway`; circuit breaker com fallback
  demonstrável.
- **3:** `memory-service` persiste histórico em Redis (curto) **e** PostgreSQL (longo);
  `retrieval-service` faz busca semântica (RAG) e ingestão de documentos.
- **4:** ≥1 fluxo assíncrono via RabbitMQ ponta-a-ponta (telemetria, ingestão ou notificação).
- **5:** Dockerfile por serviço + `docker-compose.yaml` sobe a plataforma toda com um comando.
- **6:** tracing/métricas visíveis (Jaeger/Prometheus) + pipeline de CI verde.
- **7:** manifests YAML + descrição das alterações (cluster rodando opcional).
- **8:** relatório técnico (com experimentos), vídeo não-listado, apresentação.
