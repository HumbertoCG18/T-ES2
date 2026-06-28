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

## Status atual (2026-06-28)

**Onde estamos:** Entregas **1–4 concluídas e verificadas ao vivo**. **Os 7 microsserviços da
spec existem** (agent-service, llm-gateway, memory-service, retrieval-service, **tool-registry**,
api-gateway, name-server). Frontend bônus bem avançado (estilo claude.ai). Próxima entrega de
spec = **Entrega 5 (Containerização)**.

**Feito (commitado no branch `dev-HCG`):**
- ✅ **Entrega 1** — `agent-service` (ciclo agêntico, `/chat`) + `llm-gateway` (LiteLLM/Ollama).
- ✅ **Entrega 2** — `name-server` (Eureka), `api-gateway` (Spring Cloud Gateway), circuit breaker.
- ✅ **Entrega 3** — `memory-service` (Redis curto + Postgres longo) + `retrieval-service`
  (FastAPI + ChromaDB) integrados ao `/chat` (`conversationId`, histórico, RAG, citações). ADRs 0007–0009.
- ✅ **Entrega 4** — RabbitMQ: ingestão de documentos assíncrona (polyglot) + telemetria persistida. ADR 0010.
- ✅ **tool-registry** (microsserviço nº 5): 7 ferramentas remotas (calculator, datetime, db_query,
  knowledge_search, unit_convert, text_stats, random). ADR 0011.
- ✅ **Capacidades de plataforma**: rate limiting no gateway (429), toggles de memória/RAG por
  conversa + ver/limpar memória, saúde dos serviços ao vivo, upload→RAG, seletor de modelo real.
- 🔨 **Bônus frontend** — app shell estilo claude.ai: views Conversas/Projetos/Capacidades, favoritos,
  agrupamento por projeto, citar trecho, code blocks, timeline, projetos (instruções/memória/arquivos
  com barra de capacidade), configurações (fonte/tipo de resposta/instruções), excluir projeto.

**Foco agora:** **Entrega 5 (Containerização)** — Dockerfile por serviço + `docker-compose.yaml`
completo subindo a plataforma toda com um comando. Depois 6–8.

**Falta (spec):** Entregas 5–8 (containers, observabilidade+CI, K8s, relatório+vídeo) + não-código
(benchmarks de desempenho, discussão de riscos).

## Estado das entregas

| # | Entrega | Plano | Status |
|---|---------|-------|--------|
| 1 | Fundação — agent-service + llm-gateway (REST) | — | ✅ Concluída |
| 2 | Infraestrutura — Eureka + api-gateway + circuit breaker | [`02-infraestrutura.md`](02-infraestrutura.md) | ✅ Concluída (verificada ao vivo) |
| 3 | Memória e RAG — memory-service + retrieval-service | [`03-memoria-rag.md`](03-memoria-rag.md) | ✅ Concluída (verificada ao vivo: memória 2 níveis, RAG ancorado 3/3, discovery `lb://`, resiliência, back-compat; frontend passa `conversationId`; ADRs 0007/0008/0009) |
| 4 | Mensageria — RabbitMQ (fluxos assíncronos) | [`04-mensageria.md`](04-mensageria.md) | ✅ Concluída (verificada ao vivo: ingestão async polyglot + telemetria persistida; desacoplamento e resiliência provados; ADR 0010) |
| 5 | Containerização — Dockerfiles + docker-compose | [`05-containerizacao.md`](05-containerizacao.md) | ✅ Concluída (7 imagens via `docker compose build`; `up` sobe 12 containers; Eureka in-container UP + roteamento `lb://` verificados; chat requer `ollama pull`; ADR 0012) |
| 6 | Observabilidade — OpenTelemetry + Jaeger + CI | `06-observabilidade.md` | ⬜ A planejar |
| 7 | Produção em nuvem — manifests + descrição K8s | `07-nuvem-k8s.md` | ⬜ A planejar |
| 8 | Entrega final — relatório + vídeo + apresentação | `08-entrega-final.md` | ⬜ A planejar |
| T | tool-registry (microsserviço nº 5 da spec) | [`T-tool-registry.md`](T-tool-registry.md) | ✅ Concluído (7 ferramentas remotas: calculator, datetime, db_query, knowledge_search, unit_convert, text_stats, random; ADR 0011) |
| B | Bônus — frontend (app shell + demo) | [`B-frontend.md`](B-frontend.md) | 🔨 Em andamento (views Conversas/Projetos/Capacidades, favoritos, citações, toggles memória/RAG, configurações) |

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
