# ADR 0001 — `agent-service` em Spring Boot (não Python)

**Status:** Aceito · **Data:** 2026-06-26

## Contexto

A spec deixa o `agent-service` em aberto: "Spring Boot ou Python (FastAPI)". Dos 7
microsserviços, 4 são naturalmente Spring (`memory-service`, `tool-registry`, `api-gateway`
via Spring Cloud Gateway, `name-server` via Eureka). A spec também exige service discovery
(Eureka) e circuit breaker (Resilience4j) — ambos do ecossistema Spring Cloud.

## Decisão

Implementar o `agent-service` em **Spring Boot**.

## Consequências

**Prós**
- Coesão: 5 dos 7 serviços compartilham build, padrões e dependências.
- Reuso direto de Spring Cloud: Eureka client e Resilience4j sem integração extra — menos
  código de infraestrutura.

**Contras / trade-offs**
- Abre mão das bibliotecas de agentes mais ricas do ecossistema Python (frameworks de
  agent loop, tool calling). O ciclo agêntico é implementado à mão sobre a API
  OpenAI-compatível do gateway — aceitável para o escopo do MVP.

Apenas o `retrieval-service` (RAG) permanece em Python (FastAPI), por causa do ferramental de
vetores/embeddings.
