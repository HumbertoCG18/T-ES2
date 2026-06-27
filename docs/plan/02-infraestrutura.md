# Plano — Entrega 2: Infraestrutura

**Status:** Planejada (pronta para implementar) · **Atualizado:** 2026-06-26

## Objetivo

Implementar a camada de infraestrutura de microsserviços — `name-server` (Eureka), `api-gateway` (Spring Cloud Gateway) e circuit breaker (Resilience4j) — de modo que o `agent-service` registre-se por nome lógico no Eureka, seja acessível exclusivamente pelo gateway, e responda com **fallback** quando o `llm-gateway` estiver fora do ar. **Pronto** = `curl` no gateway atinge `/chat` via discovery (sem host/porta fixos) e, com o `llm-gateway` derrubado, a resposta vem do fallback em vez de erro 5xx.

## Escopo

- **Inclui:**
  - Módulo Maven novo `name-server/` — Eureka Server (`@EnableEurekaServer`, porta 8761, sem auto-registro).
  - Módulo Maven novo `api-gateway/` — Spring Cloud Gateway como ponto de entrada único (porta **8080**), Eureka client, roteando para `lb://agent-service`.
  - `agent-service` vira Eureka client (registro com nome lógico `agent-service`).
  - Circuit breaker Resilience4j no `agent-service`, em volta da chamada ao `llm-gateway` (`LlmClient.complete`), com método de fallback.
  - BOM `spring-cloud-dependencies` (release train **2025.0.x**) adicionado por módulo que usa Spring Cloud.
  - Actuator expondo `health` + endpoints de circuit breaker para demonstração.
  - Atualização de docs: `architecture.md`, `plan/README.md`, `runbook.md` e **ADR** justificando a posição do circuit breaker.
- **Não inclui:**
  - `memory-service`, `retrieval-service`, `tool-registry` e RAG → **Entrega 3**.
  - RabbitMQ / fluxos assíncronos → **Entrega 4**.
  - Dockerfiles e `docker-compose.yaml` → **Entrega 5** (nesta entrega tudo roda como processo local).
  - Observabilidade (OpenTelemetry/Jaeger) e CI → **Entrega 6**.
  - Rate limiting, autenticação no gateway e config server (fora do critério de aceite desta entrega).

## Decisões de design (recomendações com justificativa)

### Onde fica o circuit breaker — **recomendado: no `agent-service`, em volta da chamada ao `llm-gateway`**

- **Recomendação:** circuit breaker primário no `agent-service`, anotando `LlmClient.complete(...)` com `@CircuitBreaker(name="llmGateway", fallbackMethod=...)`.
- **Justificativa:**
  1. É exatamente o exemplo canônico da spec ("quando o `llm-gateway` está indisponível, o `agent-service` responde com fallback adequado").
  2. O **domínio da falha** é a dependência do LLM; só o `agent-service` conhece um fallback **semântico** (ex.: mensagem amigável "serviço de IA temporariamente indisponível"). O gateway só saberia devolver 503 genérico.
  3. A chamada é síncrona via `RestClient` dentro de um bean Spring (`@Component LlmClient`) — o aspecto `@CircuitBreaker` do `resilience4j-spring-boot3` funciona por AOP sem refatorar nada.
  4. Mantém o gateway burro/genérico (só roteamento + discovery), o que é mais fácil de evoluir.
- **Defesa em profundidade (opcional, marcado como tarefa não-bloqueante):** filtro `CircuitBreaker` na rota do gateway (`lb://agent-service`) com `fallbackUri: forward:/fallback/agent`. Protege contra o **`agent-service` inteiro** estar fora (cenário diferente). Útil para a apresentação, mas **não** é o cenário exigido — fica como item opcional.

### Discovery — **Eureka** (não discovery nativo do Compose/K8s)

A spec exige `name-server`/Eureka explicitamente e o `architecture.md` já fixa "resolução por nome lógico via Eureka". Gateway resolve `agent-service` por `lb://agent-service` usando Spring Cloud LoadBalancer (vem junto do eureka-client) — **sem host/porta fixos**.

### Porta do `api-gateway` — **8080**

4000 = `llm-gateway`, 8081 = `agent-service`, 8761 = `name-server`. **8080** está livre e é a porta convencional de um gateway. Cliente externo passa a falar **só** com `http://localhost:8080`.

## Tarefas (decomposição para subagents)

| # | Tarefa | Subagent sugerido | Arquivos | Depende de |
|---|--------|-------------------|----------|------------|
| 1 | Confirmar compatibilidade do release train Spring Cloud **2025.0.x** com Boot 3.5.9 e o **artifactId correto do starter de gateway** (ver risco R1: `spring-cloud-starter-gateway` vs `-gateway-server-webflux`). Verificar nomes dos starters Eureka. | `Explore` / `context7` | — (leitura) | — |
| 2 | Criar módulo `name-server/`: `pom.xml` (parent boot 3.5.9, `<java.version>21</java.version>`, `dependencyManagement` com BOM `spring-cloud-dependencies:2025.0.x`, deps `spring-cloud-starter-netflix-eureka-server` + `spring-boot-starter-actuator`), `NameServerApplication.java` com `@SpringBootApplication @EnableEurekaServer` (pacote `com.tes2.nameserver`), `application.yaml` (porta 8761, `eureka.client.register-with-eureka: false`, `fetch-registry: false`). | `general-purpose` | `name-server/pom.xml`, `name-server/src/main/java/com/tes2/nameserver/NameServerApplication.java`, `name-server/src/main/resources/application.yaml` | 1 |
| 3 | Criar módulo `api-gateway/`: `pom.xml` (BOM 2025.0.x, deps `spring-cloud-starter-gateway`, `spring-cloud-starter-netflix-eureka-client`, `spring-cloud-starter-circuitbreaker-reactor-resilience4j` [só se fizer a tarefa 6 opcional], `spring-boot-starter-actuator`), `ApiGatewayApplication.java` (`@SpringBootApplication`, pacote `com.tes2.apigateway`), `application.yaml` (porta 8080, `spring.application.name: api-gateway`, default-zone do Eureka, rota `id: agent-service / uri: lb://agent-service / predicate Path=/chat/**`). | `general-purpose` | `api-gateway/pom.xml`, `api-gateway/src/main/java/com/tes2/apigateway/ApiGatewayApplication.java`, `api-gateway/src/main/resources/application.yaml` | 1, 2 |
| 4 | Transformar `agent-service` em Eureka client: adicionar BOM 2025.0.x + `spring-cloud-starter-netflix-eureka-client` ao `pom.xml`; em `application.yaml` adicionar `eureka.client.service-url.defaultZone: ${EUREKA_URL:http://localhost:8761/eureka}` e `eureka.instance.prefer-ip-address: true`. (Nome lógico já é `agent-service` em `spring.application.name`.) | `cavecrew-builder` | `agent-service/pom.xml`, `agent-service/src/main/resources/application.yaml`, (opcional `AgentServiceApplication.java` — `@EnableDiscoveryClient` é dispensável no Spring Cloud atual) | 1 |
| 5 | Adicionar circuit breaker no `agent-service`: dep `spring-cloud-starter-circuitbreaker-resilience4j` no `pom.xml`; anotar `LlmClient.complete(...)` com `@CircuitBreaker(name="llmGateway", fallbackMethod="completeFallback")`; criar método `completeFallback(List<ChatMessage>, List<ToolSpec>, Throwable)` que retorna um `ChatMessage` assistant com texto de indisponibilidade (sem tool calls → o `AgentLoop` o trata como resposta final); bloco `resilience4j.circuitbreaker.instances.llmGateway` no `application.yaml`; expor actuator `health,info,circuitbreakers,circuitbreakerevents` + `management.health.circuitbreakers.enabled: true`. | `cavecrew-builder` | `agent-service/pom.xml`, `agent-service/src/main/java/com/tes2/agent/llm/LlmClient.java`, `agent-service/src/main/resources/application.yaml` | 4 |
| 6 | (Opcional, defesa em profundidade) Filtro `CircuitBreaker` na rota do gateway com `fallbackUri: forward:/fallback/agent` + `FallbackController` reativo retornando 503/JSON amigável. | `general-purpose` | `api-gateway/.../web/FallbackController.java`, `api-gateway/src/main/resources/application.yaml` | 3 |
| 7 | Atualizar documentação: marcar Entrega 2 e serviços em `architecture.md` e `plan/README.md`; adicionar ao `runbook.md` a ordem de subida (Eureka → llm-gateway → agent-service → gateway) e os comandos de verificação/fallback; criar **ADR 0005** "Circuit breaker no agent-service (chamada ao llm-gateway)"; atualizar índice de ADRs. | `cavecrew-builder` | `docs/architecture.md`, `docs/plan/README.md`, `docs/runbook.md`, `docs/adr/0005-circuit-breaker-agent-service.md`, `docs/adr/README.md` | 2,3,4,5 |
| 8 | Integração e verificação (thread principal): `mvn -q -pl ... package` de cada módulo, subir os 4 processos, validar dashboard Eureka, rota do gateway e cenário de fallback. | thread principal | — | 2–6 |

## Portas e endpoints

| Serviço | Módulo Maven | Porta | Nome lógico (Eureka) | Endpoints-chave |
|---------|--------------|-------|----------------------|-----------------|
| `name-server` | `name-server/` (novo) | **8761** | (não se registra) | Dashboard `http://localhost:8761` · `/actuator/health` |
| `api-gateway` | `api-gateway/` (novo) | **8080** | `api-gateway` | `POST http://localhost:8080/chat` → `lb://agent-service` · `/actuator/gateway/routes` |
| `agent-service` | `agent-service/` (existente) | 8081 | `agent-service` | `POST /chat` · `/actuator/health` · `/actuator/circuitbreakers` |
| `llm-gateway` | `llm-gateway/` (existente) | 4000 | (não muda nesta entrega) | `/v1/chat/completions` |
| Ollama | — | 11434 | — | backend do `llm-gateway` |

> Após a entrega, o cliente externo fala **só** com `http://localhost:8080`. Acesso direto a 8081 fica como atalho de debug.

## Configurações de referência (esboço, não-final)

`agent-service` — `resilience4j` no `application.yaml`:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      llmGateway:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 10
        minimum-number-of-calls: 5
        failure-rate-threshold: 50
        wait-duration-in-open-state: 10s
        permitted-number-of-calls-in-half-open-state: 3
        register-health-indicator: true
```

`api-gateway` — rota por discovery:

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: agent-service
          uri: lb://agent-service
          predicates:
            - Path=/chat/**
```

## Critérios de aceite

- [ ] `name-server` sobe na 8761; dashboard lista `AGENT-SERVICE` e `API-GATEWAY` como `UP`.
- [ ] `agent-service` registra-se no Eureka com nome lógico `agent-service` (sem host/porta hard-coded em config de serviço-a-serviço).
- [ ] `POST http://localhost:8080/chat` retorna a mesma resposta do ciclo agêntico que `POST http://localhost:8081/chat` — roteado via `lb://agent-service` (discovery, não URL fixa).
- [ ] **Fallback demonstrável:** com o `llm-gateway` derrubado, `POST http://localhost:8080/chat` retorna a mensagem de fallback (HTTP 200 com texto de indisponibilidade), **não** 500/timeout propagado; o circuit breaker `llmGateway` transita para `OPEN`.
- [ ] `GET http://localhost:8081/actuator/circuitbreakers` mostra o estado do breaker `llmGateway`; `/actuator/circuitbreakerevents` registra os eventos de falha/abertura.
- [ ] Restaurado o `llm-gateway`, após `wait-duration-in-open-state` o breaker volta a `HALF_OPEN`→`CLOSED` e o `/chat` via gateway volta a responder normalmente.
- [ ] `mvn package` passa nos três módulos Spring (`name-server`, `api-gateway`, `agent-service`), incluindo testes existentes do `agent-service`.
- [ ] Docs atualizados: `architecture.md`, `plan/README.md`, `runbook.md` e ADR da posição do circuit breaker.

## Riscos / decisões em aberto

- **R1 — artifactId do starter de gateway no 2025.0.x.** No release train atual o starter pode ter sido renomeado para `spring-cloud-starter-gateway-server-webflux` (com `spring-cloud-starter-gateway` mantido como alias). **Ação:** confirmar na tarefa 1 (via `context7`/docs) antes de fixar o `pom.xml`. Não bloqueia o desenho.
- **R2 — circuit breaker no agent-service vs gateway.** Decidido: primário no `agent-service` (ver justificativa). Vira **ADR 0005**. Gateway-level CB fica opcional (tarefa 6).
- **R3 — assinatura do método de fallback.** O `fallbackMethod` precisa **mesmos parâmetros + `Throwable`** e **mesmo tipo de retorno** (`ChatMessage`). Retornar um assistant sem `toolCalls` para que o `AgentLoop` encerre o ciclo como resposta final. Validar que a exceção de conexão recusada (porta 4000 fora) é capturada pelo breaker (RestClient lança `ResourceAccessException`/`RestClientException` → conta como falha).
- **R4 — Gateway reativo (WebFlux) vs agent-service servlet.** São processos separados; não há conflito de stack. Se a tarefa 6 (CB no gateway) for feita, usar `spring-cloud-starter-circuitbreaker-reactor-resilience4j` (variante reativa), **não** a versão servlet.
- **R5 — Timeout vs circuit breaker.** Modelos locais são lentos (`request_timeout: 600` no LiteLLM). Sem time limiter, "indisponível" = conexão recusada, que é o cenário de demo. Não adicionar `@TimeLimiter` agressivo nesta entrega para não cortar inferências legítimas; registrar como decisão.
- **R6 — `eureka.instance.prefer-ip-address`.** Em Windows/local pode haver resolução de hostname inconsistente; usar `prefer-ip-address: true` evita o gateway resolver um hostname inalcançável.

## Verificação (passo a passo executável)

Subida (4 terminais, **nesta ordem**):

```text
1) name-server:    cd name-server   && .\mvnw.cmd spring-boot:run      # 8761
2) llm-gateway:    cd llm-gateway   && $env:OLLAMA_BASE_URL="http://localhost:11434"; uv run litellm --config config.yaml --port 4000
3) agent-service:  cd agent-service && .\mvnw.cmd spring-boot:run      # 8081, registra no Eureka
4) api-gateway:    cd api-gateway   && .\mvnw.cmd spring-boot:run      # 8080, registra no Eureka
```

Provas:

```text
# 1. Eureka enxerga os serviços (dashboard no navegador)
http://localhost:8761            -> AGENT-SERVICE e API-GATEWAY como UP

# 2. Acesso via gateway (discovery, sem host/porta fixos)
curl http://localhost:8080/chat -H "Content-Type: application/json" ^
  -d "{\"message\":\"Quanto e (12 + 8) * 3? Use a calculadora.\"}"
# Esperado: mesmo { "reply": ..., "trace": [...] } do acesso direto à 8081

# 3. Rota resolvida por lb:// (opcional, inspeção)
http://localhost:8080/actuator/gateway/routes   -> uri "lb://agent-service"

# 4. FALLBACK demonstrável: derrubar o llm-gateway (Ctrl+C no terminal 2) e repetir:
curl http://localhost:8080/chat -H "Content-Type: application/json" ^
  -d "{\"message\":\"Oi\"}"
# Esperado: HTTP 200 com texto de fallback ("...serviço de IA temporariamente indisponível...")

# 5. Estado do breaker
http://localhost:8081/actuator/circuitbreakers        -> llmGateway: OPEN
http://localhost:8081/actuator/circuitbreakerevents   -> eventos ERROR + STATE_TRANSITION

# 6. Recuperação: religar o llm-gateway, aguardar wait-duration-in-open-state, repetir passo 2
#    -> breaker volta a CLOSED e /chat via gateway responde normalmente
```

## Ordem de execução e paralelismo

1. **Tarefa 1** (confirmar BOM/artefatos) — primeiro, destrava todas. Curta.
2. **Paralelizável após a 1:**
   - **Tarefa 2** (`name-server`) — independente.
   - **Tarefa 4** (`agent-service` → Eureka client) — independente da 2/3.
3. **Tarefa 3** (`api-gateway`) — depende conceitualmente do nome lógico `agent-service` (tarefa 4) e da existência do Eureka (tarefa 2); pode começar em paralelo, mas seu **teste** exige 2 e 4 prontas.
4. **Tarefa 5** (circuit breaker) — depende da 4 (mesmo módulo/`pom.xml`); fazer **após** a 4 para evitar conflito no `agent-service`.
5. **Tarefa 6** (CB no gateway, opcional) — após a 3; só se houver tempo.
6. **Tarefa 7** (docs + ADR) — após 2–5 estabilizarem.
7. **Tarefa 8** (integração/verificação) — thread principal, por último.

**Caminho crítico:** 1 → 4 → 5 → 8. **Lotes paralelos:** {2, 4} juntos; depois {3, 5}; depois {6, 7}.

## Arquivos críticos para a implementação

- `agent-service/src/main/java/com/tes2/agent/llm/LlmClient.java` — ponto exato do `@CircuitBreaker` + método de fallback.
- `agent-service/src/main/resources/application.yaml` — Eureka client + bloco `resilience4j` + actuator.
- `agent-service/pom.xml` — BOM `spring-cloud-dependencies` 2025.0.x + starters eureka-client/circuitbreaker.
- `docs/plan/_template.md` — estrutura que o plano segue; `docs/architecture.md` — status/contrato de discovery a atualizar.
- `llm-gateway/config.yaml` — dependência cujo down dispara o fallback (referência do cenário de verificação).
