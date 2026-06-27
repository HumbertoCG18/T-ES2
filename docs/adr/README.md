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
