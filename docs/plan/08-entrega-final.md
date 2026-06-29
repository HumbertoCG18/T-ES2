# Roteiro — Entrega 8: Relatório técnico + Vídeo + Apresentação

**Status:** A executar · **Atualizado:** 2026-06-28 · **Prazo final:** 03/07/2026

> Toda a parte de **código/infra (Entregas 1–7) está pronta**. A Entrega 8 é **documentação +
> demonstração**: não tem mais o que programar. Este roteiro diz exatamente o que produzir.

## O que a Entrega 8 precisa entregar (checklist)

- [ ] **(a) Diagrama de arquitetura** — versão visual (não só o ASCII).
- [ ] **(f) Relatório técnico** — decisões + justificativas + trade-offs + dificuldades.
- [ ] **Experimentação / avaliação de desempenho** — benchmarks (latência/throughput) **com
  interpretação crítica** (exigido explicitamente pela spec).
- [ ] **Discussão de riscos** — segurança, performance, escalabilidade, disponibilidade.
- [ ] **(g) Análise de evolução para nuvem** — ✅ já escrita em [`../cloud-evolution.md`](../cloud-evolution.md) (revisar e incluir).
- [ ] **(h) Descrição das alterações para Kubernetes** — ✅ já em `../../k8s/` + cloud-evolution (incluir).
- [ ] **Circuit breaker demonstrado** — cenário de fallback gravado no vídeo.
- [ ] **Vídeo de demonstração** — YouTube **não-listado**.
- [ ] **Apresentação final** — slides.

Insumo já pronto: **ADRs 0001–0016** ([`../adr/`](../adr/)) = decisões + trade-offs prontos para
o relatório; [`architecture.md`](../architecture.md) = arquitetura e fluxos; [`GUIA-DO-SISTEMA.md`](../GUIA-DO-SISTEMA.md) = visão geral.

---

## Passo 1 — Diagrama de arquitetura (visual)

- **Ferramenta:** Excalidraw, draw.io ou Mermaid (Mermaid já renderiza no GitHub/relatório).
- **Base:** o diagrama ASCII em [`architecture.md`](../architecture.md) (seção "Diagrama").
- **Mostrar:** os 7 serviços + infra; as setas de **REST síncrono** (gateway→agent→serviços),
  **discovery** (todos→Eureka), **assíncrono** (RabbitMQ: ingestão + telemetria), **circuit breaker**
  (agent→llm-gateway) e **tracing** (→Jaeger). Destacar que só o `api-gateway` é exposto.
- **Saída:** exportar PNG/SVG para o relatório e a apresentação.

Esqueleto Mermaid pronto para colar e ajustar:
```mermaid
flowchart TD
  Cliente["Cliente / Frontend"] --> GW["api-gateway :8080"]
  GW --> AG["agent-service :8081"]
  AG --> LLM["llm-gateway :4000"] --> OLL["Ollama"]
  AG --> MEM["memory-service :8082"] --> RED["(Redis)"] & PG["(PostgreSQL)"]
  AG --> RET["retrieval-service :8083"] --> CH["(ChromaDB)"]
  AG --> TR["tool-registry :8084"]
  EUR["name-server / Eureka :8761"] -.registro/descoberta.- GW & AG & MEM & RET & TR
  AG -. telemetry.events .-> RMQ[("RabbitMQ")] -.-> MEM
  AG -. document.ingest .-> RMQ -.-> RET
  AG & MEM & RET & TR -. OTLP .-> JG["Jaeger :16686"]
```

## Passo 2 — Experimentação / avaliação de desempenho (benchmarks)

Medir e **interpretar** (não basta a tabela — explicar o porquê).

**Cenários sugeridos:**
1. **Latência do `/chat`** (ponta-a-ponta via gateway) — com ferramenta vs sem ferramenta; com RAG
   vs sem RAG; primeira chamada vs subsequentes (efeito do histórico/cache).
2. **Throughput** — várias requisições concorrentes; ver onde satura (provavelmente o LLM/Ollama).
3. **Circuit breaker** — latência/erro com o `llm-gateway` **fora do ar** (deve cair no fallback rápido).
4. **Ingestão assíncrona** — tempo de resposta do `POST /documents/ingest` (202 imediato) vs tempo
   real de indexação (consumidor) — mostra o ganho do desacoplamento.

**Como medir (ferramentas simples):**
```bash
# Latência simples (tempo de uma chamada)
curl -w "\n%{time_total}s\n" -o /dev/null -s http://localhost:8080/chat \
  -H "Content-Type: application/json" -d '{"message":"oi"}'

# Carga/concorrência: hey (https://github.com/rakyll/hey) ou Apache Bench (ab)
hey -n 50 -c 5 -m POST -T application/json \
  -d '{"message":"Quanto e 2+2?"}' http://localhost:8080/chat
```

**Fonte de dados real (já temos):** a **telemetria** persistida — cada `/chat` grava latência e
ferramentas usadas em `telemetry_event` (PostgreSQL). Consultar via `GET http://localhost:8082/telemetry`
ou direto no banco. Use isso para gráficos de latência por chamada.

> **Dica de interpretação:** o gargalo esperado é a **inferência do LLM** (CPU sem GPU). Mostre que a
> infra (gateway, discovery, memória) tem overhead baixo e que o circuit breaker **derruba a latência
> de cauda** quando o LLM falha. Comente o trade-off CPU vs GPU.

Registrar os números numa tabela + 1–2 gráficos, com 2–3 parágrafos de análise crítica.

## Passo 3 — Discussão de riscos

Cobrir os 4 eixos com exemplos **concretos do sistema** (não genéricos):
- **Segurança:** LLM local mitiga vazamento de dados; `db_query` é SELECT read-only (allowlist);
  faltam autenticação no gateway e secrets gerenciados (apontar como evolução).
- **Performance:** LLM é o gargalo (CPU); mitigações: cache de memória, GPU, modelo leve (`gemma3:4b`).
- **Escalabilidade:** serviços stateless escalam horizontalmente (HPA); stateful → serviços
  gerenciados (ver cloud-evolution).
- **Disponibilidade:** circuit breakers + fallback + probes; ponto único atual = `name-server` (Eureka),
  removível no K8s.

## Passo 4 — Relatório técnico (estrutura sugerida)

1. **Capa / identificação** (disciplina, grupo, parceiro Nubo).
2. **Introdução** — problema, objetivo, escopo (resumo do [`GUIA-DO-SISTEMA.md`](../GUIA-DO-SISTEMA.md)).
3. **Arquitetura** — diagrama (Passo 1) + descrição dos 7 serviços e dos fluxos.
4. **Decisões de arquitetura e trade-offs** — destilar os **ADRs 0001–0016** (cada ADR já tem
   contexto/decisão/consequências).
5. **Implementação por entrega** — o que foi feito em cada uma (1–7), com prints/trechos.
6. **Experimentação / desempenho** — Passo 2 (tabelas, gráficos, análise).
7. **Discussão de riscos** — Passo 3.
8. **Evolução para nuvem + Kubernetes** — Passos g/h (usar [`../cloud-evolution.md`](../cloud-evolution.md) + `k8s/`).
9. **Conclusão** — o que funcionou, dificuldades, próximos passos.
10. **Anexos** — comandos de execução, links do repositório e do vídeo.

## Passo 5 — Circuit breaker demonstrável (para o vídeo)

Cenário pronto: com a stack no ar, **derrubar o `llm-gateway`** e mostrar o `/chat` respondendo com
fallback (sem erro 5xx):
```bash
docker compose stop llm-gateway
curl http://localhost:8080/chat -H "Content-Type: application/json" -d '{"message":"oi"}'
#   -> resposta de fallback ("servico de IA temporariamente indisponivel"), rápido
docker compose start llm-gateway   # volta ao normal
```

## Passo 6 — Vídeo de demonstração (YouTube não-listado)

Roteiro de gravação (~5–10 min):
1. `docker compose up -d` → mostrar os containers no ar e o **Eureka** (:8761) com tudo UP.
2. **Frontend** (:5173): fazer uma pergunta que use **ferramenta** (ex.: cálculo) e mostrar o
   **trace do ciclo agêntico** (Pensamento/passos) + citações.
3. **Memória:** segunda pergunta na mesma conversa, mostrar que lembra do contexto; abrir
   "Ver memória".
4. **RAG:** subir um documento (upload) e perguntar algo respondido por ele (citações).
5. **Mensageria:** painel do **RabbitMQ** (:15672) mostrando as filas; ingestão assíncrona.
6. **Observabilidade:** um pedido no **Jaeger** (:16686) atravessando os serviços.
7. **Circuit breaker:** Passo 5 ao vivo (derrubar o llm-gateway).
8. Fechar com o **diagrama** e os pontos de evolução (nuvem/K8s).

Subir como **não-listado** e colocar o link no relatório/apresentação.

## Passo 7 — Apresentação

Slides curtos espelhando o relatório: problema → arquitetura (diagrama) → demo (do vídeo) →
desempenho → riscos → evolução nuvem → conclusão.

---

## Divisão de trabalho sugerida (grupo)

| Frente | Tarefa |
|--------|--------|
| Diagrama + slides | Passos 1 e 7 |
| Benchmarks | Passo 2 (rodar + tabelas/gráficos + análise) |
| Relatório | Passo 4 (montar a partir dos ADRs + este roteiro) |
| Riscos + nuvem | Passos 3 e 8 (cloud-evolution já escrito) |
| Vídeo | Passos 5 e 6 (gravar a demo) |

## Critério de "pronto"

- [ ] Relatório técnico completo (10 seções) entregue.
- [ ] Diagrama visual exportado e incluído.
- [ ] Tabela/gráficos de desempenho + interpretação crítica.
- [ ] Discussão de riscos (4 eixos).
- [ ] Vídeo não-listado publicado + link no relatório.
- [ ] Apresentação pronta.
