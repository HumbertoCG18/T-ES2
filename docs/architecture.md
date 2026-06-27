# Arquitetura

> Entregável (a): diagrama de arquitetura documentando microsserviços, responsabilidades e
> protocolos de comunicação. Este arquivo é a fonte; exportar um diagrama visual (Excalidraw /
> draw.io / Mermaid) para o relatório e a apresentação.

## Visão geral

Plataforma de agentes de IA conversacionais. Um agente opera no ciclo
**raciocínio → ação → observação**: recebe a requisição, raciocina via LLM, invoca ferramentas,
observa o resultado e repete até a resposta final. Roda 100% local (sem nuvem) via Docker
Compose; alvo de produção é Kubernetes.

## Microsserviços

| # | Serviço | Responsabilidade | Stack | Status |
|---|---------|------------------|-------|--------|
| 1 | `agent-service` | Orquestra o ciclo agêntico (LLM + ferramentas) | Spring Boot | ✅ Entrega 1 |
| 2 | `llm-gateway` | Proxy unificado p/ LLMs locais | LiteLLM + Ollama | ✅ Entrega 1 |
| 3 | `memory-service` | Histórico: curto prazo (Redis) + longo prazo (PostgreSQL) | Spring Boot | ⬜ Entrega 3 |
| 4 | `retrieval-service` | Busca semântica / RAG + ingestão de docs | FastAPI + ChromaDB | ⬜ Entrega 3 |
| 5 | `tool-registry` | Registra/expõe ferramentas invocáveis | Spring Boot | ⬜ Entrega 3+ |
| 6 | `api-gateway` | Entrada única: roteamento (circuit breaker no agent-service) | Spring Cloud Gateway | ✅ Entrega 2 |
| 7 | `name-server` | Service discovery | Eureka Server | ✅ Entrega 2 |

## Protocolos de comunicação

- **Síncrono (REST/HTTP):** Cliente → `api-gateway` → `agent-service` → demais serviços.
  Gateway é o único ponto de entrada externo.
- **Service discovery:** todos registram no `name-server` (Eureka); resolução por **nome
  lógico**, nunca host/porta fixos.
- **Assíncrono (RabbitMQ):** desacopla produtor/consumidor. Usos previstos: telemetria do
  `agent-service` (latência, ferramentas, chamadas ao LLM); ingestão de documentos para o
  `retrieval-service`; notificações entre agentes.
- **Resiliência (Resilience4j):** circuit breaker no caminho `agent-service` → `llm-gateway`;
  fallback quando o LLM está indisponível.
- **Observabilidade:** OpenTelemetry + Jaeger (tracing) e/ou Prometheus + Grafana (métricas).

## Diagrama (lógico, ASCII — substituir por versão visual no relatório)

```
              Cliente (HTTP / curl / frontend)
                        |
                        v
                 [ api-gateway ]  <--- registra ---> [ name-server (Eureka) ]
                        |
                        v
                 [ agent-service ] ---- ciclo agêntico ----+
                    |     |      |                          |
        +-----------+     |      +-----------+              | (async)
        v                 v                  v              v
  [ llm-gateway ]  [ memory-service ]  [ tool-registry ]  [ RabbitMQ ]
        |             Redis + Postgres                       |
        v                                                    v
   [ Ollama ]                                       [ retrieval-service ]
   (LLM local)                                       ChromaDB / Qdrant
                        \                 /
                         v               v
                  OpenTelemetry + Jaeger + Prometheus
```

## Estado atual (Entrega 1 — Fundação)

`agent-service` (Spring Boot) recebe `POST /chat`, executa o ciclo agêntico com ≥1 chamada ao
LLM e ≥1 ferramenta (calculadora), conversando via REST com `llm-gateway` (LiteLLM → Ollama
`llama3.1`). Sem containers ainda; cada serviço roda como processo local.
