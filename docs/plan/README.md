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

## Estado das entregas

| # | Entrega | Plano | Status |
|---|---------|-------|--------|
| 1 | Fundação — agent-service + llm-gateway (REST) | — | ✅ Concluída |
| 2 | Infraestrutura — Eureka + api-gateway + circuit breaker | [`02-infraestrutura.md`](02-infraestrutura.md) | ✅ Concluída (verificada ao vivo) |
| 3 | Memória e RAG — memory-service + retrieval-service | `03-memoria-rag.md` | ⬜ A planejar |
| 4 | Mensageria — RabbitMQ (fluxos assíncronos) | `04-mensageria.md` | ⬜ A planejar |
| 5 | Containerização — Dockerfiles + docker-compose | `05-containerizacao.md` | ⬜ A planejar |
| 6 | Observabilidade — OpenTelemetry + Jaeger + CI | `06-observabilidade.md` | ⬜ A planejar |
| 7 | Produção em nuvem — manifests + descrição K8s | `07-nuvem-k8s.md` | ⬜ A planejar |
| 8 | Entrega final — relatório + vídeo + apresentação | `08-entrega-final.md` | ⬜ A planejar |
| B | Bônus — frontend shadcn (demo) | `B-frontend.md` | ⬜ Opcional |

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
