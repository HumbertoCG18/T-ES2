# ADR 0005 — Circuit breaker no agent-service via Spring Cloud CircuitBreaker

**Status:** Aceito · **Data:** 2026-06-26

## Contexto

A spec exige circuit breaker demonstrável: "quando o llm-gateway está indisponível, o
agent-service responde com fallback adequado". Duas decisões: **onde** colocar o breaker e
**qual** integração Resilience4j usar.

## Decisão

**Onde:** no `agent-service`, em volta da chamada ao `llm-gateway` (`LlmClient.complete`).
Só o `agent-service` conhece um fallback *semântico* (mensagem amigável de indisponibilidade);
o gateway só devolveria um 503 genérico. É o cenário canônico da spec.

**Como:** `spring-cloud-starter-circuitbreaker-resilience4j` (API programática
`CircuitBreakerFactory.create("llmGateway").run(supplier, fallback)`), configurado por um
`Customizer<Resilience4JCircuitBreakerFactory>` em `ResilienceConfig.java`.

## Por que não a anotação `@CircuitBreaker` (resilience4j-spring-boot3)

Tentativa inicial usou `io.github.resilience4j:resilience4j-spring-boot3` com a anotação. Falhou
no startup: `NoClassDefFoundError: io.github.resilience4j.spring6.fallback.RxJava3FallbackDecorator`
— **skew de versão** entre o `resilience4j-spring-boot3:2.3.0` (pinado à mão) e o `resilience4j-spring6`
gerido pelo BOM `spring-cloud-dependencies:2025.0.0`. A API do Spring Cloud CircuitBreaker é
gerida pelo mesmo BOM, então não há skew — escolha mais robusta para este stack.

## Consequências

**Prós**
- Versões alinhadas pelo release train; sem pin manual de Resilience4j.
- Fallback semântico no lugar certo; ciclo agêntico encerra limpo (assistant sem tool_calls).

**Contras / trade-offs**
- Não há os endpoints actuator `circuitbreakers`/`circuitbreakerevents` (são do
  `resilience4j-spring-boot3`). O estado é demonstrado pela **resposta de fallback** + logs.
- O Spring Cloud CircuitBreaker aplica um **TimeLimiter** (default 1s). Como o LLM local é
  lento, configuramos `timeoutDuration = 600s`; "indisponível" = conexão recusada (gateway fora),
  que é o cenário de demonstração.

**Opcional (defesa em profundidade, não implementado):** filtro CircuitBreaker no `api-gateway`
protege contra o `agent-service` inteiro fora — cenário diferente, fica para depois.
