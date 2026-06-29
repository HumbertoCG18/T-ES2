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

**Onde estamos:** Entregas **1–7 concluídas e verificadas ao vivo** — **toda a parte de
dev/infra está pronta**. Os 7 microsserviços existem; a plataforma sobe via `docker compose up`
(containers + infra + Ollama + Jaeger) com tracing OTel→Jaeger e CI; e há manifests K8s (`k8s/`) +
análise de evolução para nuvem. Frontend bônus bem avançado (estilo claude.ai). **Falta só a
Entrega 8** (relatório técnico + vídeo + apresentação, englobando diagrama, benchmarks e riscos).

**Feito (commitado no branch `dev-HCG`):**
- ✅ **Entrega 1** — `agent-service` (ciclo agêntico, `/chat`) + `llm-gateway` (LiteLLM/Ollama).
- ✅ **Entrega 2** — `name-server` (Eureka), `api-gateway` (Spring Cloud Gateway), circuit breaker.
- ✅ **Entrega 3** — `memory-service` (Redis curto + Postgres longo) + `retrieval-service`
  (FastAPI + ChromaDB) integrados ao `/chat` (`conversationId`, histórico, RAG, citações). ADRs 0007–0009.
- ✅ **Entrega 4** — RabbitMQ: ingestão de documentos assíncrona (polyglot) + telemetria persistida. ADR 0010.
- ✅ **tool-registry** (microsserviço nº 5): 7 ferramentas remotas (calculator, datetime, db_query,
  knowledge_search, unit_convert, text_stats, random). ADR 0011.
- ✅ **Capacidades de plataforma**: rate limiting no gateway (429), toggles de memória/RAG por
  conversa + ver/limpar memória, saúde dos serviços ao vivo, upload→RAG, **controles do agente no
  input (modelo · esforço · raciocínio), reais e no `trace`** (ADR 0015), citações.
- ✅ **Entrega 5** — containerização: Dockerfile por serviço + `docker-compose.yaml` completo
  (7 serviços + infra + Ollama). `docker compose up` verificado in-container. ADR 0012.
- ✅ **Entrega 6** — observabilidade: tracing OTel→Jaeger (5 serviços, Java↔Python) + CI
  (GitHub Actions). ADR 0013.
- 🔨 **Bônus frontend** — app shell estilo claude.ai: views Conversas/Projetos/Capacidades, favoritos,
  agrupamento por projeto, citar trecho, code blocks, timeline, projetos (instruções/memória/arquivos
  com barra de capacidade), configurações (fonte/tipo de resposta/instruções + aba **Infraestrutura**
  com Entregas 4–7 e links p/ RabbitMQ/Jaeger), excluir projeto. **Polido em 3 passes** (design
  tokens, estados/skeletons, mobile/a11y, logomark próprio).

**Foco agora:** **Entrega 8 (final)** — relatório técnico + vídeo (YouTube não-listado) +
apresentação. Engloba os artefatos não-código: **diagrama** de arquitetura (visual), **benchmarks de
desempenho** (experimentação + interpretação crítica — a telemetria persistida é a base) e
**discussão de riscos** (segurança, performance, escalabilidade, disponibilidade). As decisões de
arquitetura já estão nos **ADRs 0001–0015** (insumo direto do relatório). **Roteiro passo a passo
pronto** em [`08-entrega-final.md`](08-entrega-final.md). Visão geral para quem chega:
[`../GUIA-DO-SISTEMA.md`](../GUIA-DO-SISTEMA.md).

**Falta (spec):** apenas a **Entrega 8** (documentação/vídeo). Toda a dev/infra (1–7) está concluída.

## Estado das entregas

| # | Entrega | Plano | Status |
|---|---------|-------|--------|
| 1 | Fundação — agent-service + llm-gateway (REST) | — | ✅ Concluída |
| 2 | Infraestrutura — Eureka + api-gateway + circuit breaker | [`02-infraestrutura.md`](02-infraestrutura.md) | ✅ Concluída (verificada ao vivo) |
| 3 | Memória e RAG — memory-service + retrieval-service | [`03-memoria-rag.md`](03-memoria-rag.md) | ✅ Concluída (verificada ao vivo: memória 2 níveis, RAG ancorado 3/3, discovery `lb://`, resiliência, back-compat; frontend passa `conversationId`; ADRs 0007/0008/0009) |
| 4 | Mensageria — RabbitMQ (fluxos assíncronos) | [`04-mensageria.md`](04-mensageria.md) | ✅ Concluída (verificada ao vivo: ingestão async polyglot + telemetria persistida; desacoplamento e resiliência provados; ADR 0010) |
| 5 | Containerização — Dockerfiles + docker-compose | [`05-containerizacao.md`](05-containerizacao.md) | ✅ Concluída (7 imagens via `docker compose build`; `up` sobe 12 containers; Eureka in-container UP + roteamento `lb://` verificados; chat requer `ollama pull`; ADR 0012) |
| 6 | Observabilidade — OpenTelemetry + Jaeger + CI | [`06-observabilidade.md`](06-observabilidade.md) | ✅ Concluída (tracing OTel→Jaeger; 5 serviços reportando incl. Java↔Python; trace multi-serviço na UI; CI GitHub Actions; ADR 0013) |
| 7 | Produção em nuvem — manifests + descrição K8s | [`07-nuvem-k8s.md`](07-nuvem-k8s.md) | ✅ Concluída (`k8s/` com 35 recursos — 7 serviços + infra + Jaeger + Ingress; `kubectl kustomize` válido; análise de evolução `cloud-evolution.md`; ADR 0014) |
| 8 | Entrega final — relatório + vídeo + apresentação | [`08-entrega-final.md`](08-entrega-final.md) | 🔨 Roteiro pronto (executar: diagrama, benchmarks, riscos, relatório, vídeo) |
| T | tool-registry (microsserviço nº 5 da spec) | [`T-tool-registry.md`](T-tool-registry.md) | ✅ Concluído (7 ferramentas remotas: calculator, datetime, db_query, knowledge_search, unit_convert, text_stats, random; ADR 0011) |
| B | Bônus — frontend (app shell + demo) | [`B-frontend.md`](B-frontend.md) | 🔨 Em andamento — funcional e **polido em 3 passes** (tokens, estados/skeletons, mobile/a11y, logomark); views Conversas/Projetos/Capacidades, favoritos, citações, toggles memória/RAG, **controles do agente no input (modelo · esforço · raciocínio, reais — ADR 0015)**, configurações + aba Infraestrutura |

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
