# ADRs — Architecture Decision Records

Cada ADR registra **uma decisão de arquitetura**: contexto, decisão e consequências/trade-offs.
Alimenta diretamente o item (f) do relatório ("decisões de arquitetura e respectivas
justificativas, análise de trade-offs").

Formato: status · contexto · decisão · consequências. Não editar ADRs aceitos — para reverter,
criar um novo ADR que substitua o anterior.

## Índice

| # | Decisão | Status |
|---|---------|--------|
| [0001](0001-agent-service-spring-boot.md) | `agent-service` em Spring Boot (não Python) | Aceito |
| [0002](0002-spring-boot-versao-java.md) | Spring Boot 3.5.9, target Java 21 sobre JDK 25 | Aceito |
| [0003](0003-llm-local-ollama-litellm.md) | LLM local via Ollama atrás do LiteLLM gateway | Aceito |
| [0004](0004-frontend-shadcn-bonus.md) | Frontend shadcn como bônus de demo | Aceito |
| [0005](0005-circuit-breaker-agent-service.md) | Circuit breaker no agent-service via Spring Cloud CircuitBreaker | Aceito |
| [0006](0006-frontend-stack.md) | Stack do frontend: Vite + React + Tailwind + shadcn (localStorage) | Aceito |
| [0007](0007-memoria-redis-postgres.md) | Memória em dois níveis: Redis (curto) + PostgreSQL (longo), write-through | Aceito |
| [0008](0008-retrieval-python-discovery.md) | retrieval-service em Python + discovery via py-eureka-client (fallback URL fixa) | Aceito |
| [0009](0009-injecao-contexto-rag.md) | Injeção de contexto RAG como system message + degradação graciosa | Aceito |
| [0010](0010-mensageria-rabbitmq.md) | Mensageria RabbitMQ: ingestão assíncrona (polyglot) + telemetria | Aceito |
| [0011](0011-tool-registry-remoto.md) | tool-registry remoto; ferramentas (calculator/datetime/db_query) fora do agent-service | Aceito |
| [0012](0012-containerizacao.md) | Containerização: Dockerfile por serviço + docker-compose completo (+ Ollama) | Aceito |
| [0013](0013-observabilidade-tracing.md) | Observabilidade: tracing distribuído (OpenTelemetry + Jaeger) + CI (GitHub Actions) | Aceito |
| [0014](0014-kubernetes-nuvem.md) | Produção em nuvem: manifests Kubernetes (paridade com o Compose) + evolução | Aceito |
| [0015](0015-controles-agente-por-requisicao.md) | Controles do agente por requisição (modelo · esforço · raciocínio) no composer | Aceito |
| [0016](0016-gerencia-modelos-ollama.md) | Gerência de modelos do Ollama pela UI (proxy via agent-service) + download com progresso | Aceito |
