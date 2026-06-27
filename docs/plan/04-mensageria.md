# Plano — Entrega 4: Mensageria (RabbitMQ)

**Status:** A planejar · **Atualizado:** 2026-06-27

## Objetivo

Introduzir **mensageria assíncrona via RabbitMQ** desacoplando produtor/consumidor em **dois
fluxos** (a spec exige ≥1; fazemos os dois exemplos canônicos):

1. **Ingestão de documentos (assíncrona, polyglot):** um produtor **Spring** publica o documento
   numa fila; o **`retrieval-service` (Python)** consome no seu ritmo e indexa no ChromaDB. Tira a
   indexação (chunk+embed+upsert, custosa) do caminho síncrono — o contrato da Entrega 3 já foi
   desenhado para virar fila.
2. **Telemetria (não-bloqueante):** o `agent-service` publica um evento por `/chat` (latência,
   iterações, ferramentas usadas, hits de RAG, modelo) **sem bloquear** a resposta ao cliente; o
   **`memory-service`** consome e **persiste** em PostgreSQL (`telemetry_event`) — vira insumo para
   a **avaliação de desempenho** (benchmarks) exigida pela spec.

**Pronto** = (1) `POST /documents/ingest` retorna **202** e o doc aparece buscável via `/search`
**depois** que o consumer Python processa a fila (visível no log do consumer e na management UI);
(2) cada `/chat` gera uma linha em `telemetry_event` no Postgres, **sem** aumentar a latência da
resposta; (3) RabbitMQ rodando em container, filas visíveis em `http://localhost:15672`;
(4) derrubar o consumer → mensagens **acumulam** na fila e são processadas quando ele volta
(prova do desacoplamento); (5) builds verdes. Tudo **100% local, sem nuvem**.

## Escopo

- **Inclui:**
  - **Infra:** RabbitMQ (`rabbitmq:3-management`, 5672 AMQP + 15672 UI) no `infra/docker-compose.infra.yaml`.
  - **Fluxo A — ingestão:** produtor no `agent-service` (`POST /documents/ingest` → publica na fila
    `document.ingest`, responde **202 Accepted**), exposto pelo `api-gateway` (`Path=/documents/**`).
    Consumidor no `retrieval-service` (**aio-pika**, task no *lifespan* do FastAPI) → reusa a lógica de
    indexação (refatorada em `index_document()`), faz upsert no ChromaDB.
  - **Fluxo B — telemetria:** produtor no `agent-service` (publica `telemetry.events` ao fim do
    `/chat`, fire-and-forget); consumidor no `memory-service` (`@RabbitListener`) → persiste
    `telemetry_event` no Postgres. Endpoint opcional `GET /telemetry` para inspeção.
  - **Config externalizada:** `RABBITMQ_HOST/PORT/USERNAME/PASSWORD` (Spring `spring.rabbitmq.*`;
    Python via env). `spring-boot-starter-amqp` nos dois módulos Spring; `aio-pika` no Python.
  - **Resiliência da publicação:** falha ao publicar **não** quebra o `/chat` (telemetria é
    best-effort; log e segue). Ingestão: se o broker estiver fora, `/documents/ingest` responde 503.
  - Docs: `architecture.md`, `runbook.md`, `plan/README.md`, ADR 0010 (mensageria).
- **Não inclui:**
  - **Dockerfiles dos serviços** e `docker-compose.yaml` completo → Entrega 5 (aqui só RabbitMQ de infra).
  - **Notificações entre agentes** (3º uso citado na spec) → fora do escopo; os 2 fluxos já cumprem.
  - **Dashboard de telemetria / Grafana** → Entrega 6 (observabilidade). Aqui só persiste os eventos.
  - **Retry/DLQ avançado, idempotência forte** → mencionar como evolução; MVP usa fila durável + ack.

## Decisões de design (recomendações com justificativa)

### Topologia simples para interop Spring ↔ Python — **default exchange + filas duráveis nomeadas**

- Sem exchange customizada: produtor publica no **default exchange** (`""`) com *routing key* = nome
  da fila; consumidor escuta a fila pelo nome. Minimiza acoplamento entre os dois mundos (Spring AMQP
  e aio-pika) — só o **nome da fila** é contrato. Filas: **`document.ingest`** e **`telemetry.events`**,
  ambas `durable=true`. (Evolução para topic exchange/DLQ fica para depois.)
- **Mensagens em JSON.** Spring usa `Jackson2JsonMessageConverter`; Python faz `json.loads` do body.

### Decoupling de tipos entre serviços — **consumer infere o tipo do parâmetro, ignora `__TypeId__`**

- O `Jackson2JsonMessageConverter` do produtor adiciona o header `__TypeId__` com o nome da classe
  (pacote do `agent-service`). O `memory-service` tem a classe noutro pacote. Para não acoplar:
  configurar o converter do **consumer** com `DefaultJackson2JavaTypeMapper` em
  **`TypePrecedence.INFERRED`** → desserializa para o tipo do parâmetro do `@RabbitListener`,
  ignorando o header. (Gotcha registrado.)

### Onde mora cada produtor/consumidor — **sem 8º microsserviço**

- A arquitetura tem **7 serviços fixos**; não criar um serviço só de ingestão/telemetria.
- **Ingestão:** produtor no `agent-service` (já é o orquestrador e fica atrás do gateway); consumidor
  no `retrieval-service` (dono do índice). Cruza linguagens de propósito (demonstra broker real).
- **Telemetria:** produtor no `agent-service`; consumidor no `memory-service` (dono da persistência —
  telemetria persistida alimenta os benchmarks). Cross-service, decoupled, e útil para a nota.

### `retrieval-service` mantém o `/ingest` síncrono — **fila é caminho adicional, não substituto**

- O `POST /ingest` síncrono continua (teste/uso direto). O consumer chama a **mesma** `index_document()`.
  Assim a fila é um segundo caminho de entrada, e o comportamento de indexação é idêntico.

### Telemetria não-bloqueante — **publicar depois de montar a resposta, em try/catch**

- O `agent-service` coleta métricas durante o ciclo (latência, nº de iterações, ferramentas, hits de
  RAG) e publica **após** ter o `AgentResult`, sem aguardar consumo. Falha de publicação é logada e
  ignorada (o `/chat` nunca quebra por telemetria).

## Tarefas (decomposição para subagents)

| # | Tarefa | Subagent | Arquivos | Depende de |
|---|--------|----------|----------|------------|
| 1 | **Validar contratos (Context7):** `spring-boot-starter-amqp` no BOM Boot 3.5.9 (`RabbitTemplate`, `@RabbitListener`, `Jackson2JsonMessageConverter`, declaração de `Queue` durável, `TypePrecedence.INFERRED`); imagem `rabbitmq:3-management` (portas 5672/15672, env `RABBITMQ_DEFAULT_USER/PASS`); **`aio-pika`** (conexão robusta, consumo no *lifespan* FastAPI, `message.ack`). | `context7` | — (leitura) | — |
| 2 | **Infra:** adicionar `rabbitmq` ao `infra/docker-compose.infra.yaml` (3-management, 5672+15672, healthcheck `rabbitmq-diagnostics ping`, volume). Atualizar `infra/README.md` (+ `docker run`). | `general-purpose` | `infra/docker-compose.infra.yaml`, `infra/README.md` | — |
| 3 | **agent-service — AMQP base + produtores:** `spring-boot-starter-amqp` no `pom`; `RabbitConfig` (beans `Queue document.ingest` e `telemetry.events`, `Jackson2JsonMessageConverter`, `RabbitTemplate`); `application.yaml` (`spring.rabbitmq.*`, chaves `messaging.*`). | `general-purpose` | `agent-service/.../config/RabbitConfig.java`, `pom.xml`, `application.yaml` | 1 |
| 4 | **agent-service — ingestão (produtor + API):** DTO `IngestionMessage`; `IngestionProducer` (RabbitTemplate → `document.ingest`); `DocumentController` (`POST /documents/ingest` → 202; 503 se broker fora). | `cavecrew-builder` | `agent-service/.../ingestion/*`, `.../web/DocumentController.java` | 3 |
| 5 | **agent-service — telemetria (produtor):** `TelemetryEventDto` (conversationId, latencyMs, iterations, toolsUsed, ragHits, model, ts); coletar métricas no `AgentLoop`/`ChatController` e publicar via `TelemetryProducer` (fire-and-forget). | `cavecrew-builder` | `agent-service/.../telemetry/*`, `.../agent/AgentLoop.java`, `.../web/ChatController.java` | 3 |
| 6 | **memory-service — consumer de telemetria:** `spring-boot-starter-amqp` no `pom`; `RabbitConfig` (fila `telemetry.events`, converter `INFERRED`); entidade `TelemetryEvent` + repo; `TelemetryListener` (`@RabbitListener` → persiste); opcional `GET /telemetry`. | `general-purpose` | `memory-service/.../telemetry/*`, `pom.xml`, `application.yaml` | 1 |
| 7 | **retrieval-service — consumer de ingestão:** `aio-pika` no `pyproject`; refatorar a indexação em `index_document()`; `consumer.py` (conecta, consome `document.ingest`, indexa, ack); subir/desligar no *lifespan*; reusar no `POST /ingest`. | `general-purpose` | `retrieval-service/app/{consumer,main,rag_index}.py`, `pyproject.toml`, `config.py` | 1 |
| 8 | **api-gateway — rota de ingestão:** `Path=/documents/**` → `lb://agent-service` (filtro de discovery, como `/chat`). | `cavecrew-builder` | `api-gateway/.../application.yaml` | 4 |
| 9 | **Docs + ADR:** `architecture.md` (fluxo async real, diagrama), `runbook.md` (subir RabbitMQ + demo das filas), `plan/README.md`; ADR 0010 (mensageria: topologia, 2 fluxos, decoupling de tipos). | `cavecrew-builder` | `docs/...` | 2–8 |
| 10 | **Integração e verificação (thread principal):** subir RabbitMQ + serviços; `POST /documents/ingest` → ver consumer indexar → `/search` acha; `/chat` → linha em `telemetry_event`; derrubar consumer → fila acumula → volta e drena. | thread principal | — | 2–9 |

## Tarefa 1 — resultados da validação (✅ 2026-06-27, via Context7)

- **Spring AMQP (Boot 3.5.9, `spring-boot-starter-amqp`):** config por `spring.rabbitmq.host/port/username/password` (ou `addresses`). `AmqpTemplate`/`RabbitTemplate`/`AmqpAdmin` auto-configurados; **se há bean `MessageConverter`**, ele liga automático no template → definir `Jackson2JsonMessageConverter` faz o produtor mandar JSON. **Todo bean `Queue` é auto-declarado** no broker. Consumo: `@RabbitListener(queues="...")`; p/ desserializar POJO, `SimpleRabbitListenerContainerFactory` com o converter (via `SimpleRabbitListenerContainerFactoryConfigurer`). Decoupling de tipo: `DefaultJackson2JavaTypeMapper` com `setTypePrecedence(TypePrecedence.INFERRED)` no converter do consumer (ignora `__TypeId__`).
- **aio-pika (Python):** `connect_robust("amqp://user:pass@host/")` (reconnect automático); `channel = await conn.channel()`, `set_qos(prefetch_count=N)`, `declare_queue(nome, durable=True)`. Consumo no lifespan: `tag = await queue.consume(on_message)` (registro **não-bloqueante**; guarda conn em `app.state`, fecha no shutdown). Ack: `async with message.process(requeue=True): ...`. Publish: `channel.default_exchange.publish(aio_pika.Message(body), routing_key=fila)`.
- **Imagem RabbitMQ:** `rabbitmq:3-management` (AMQP 5672 + UI 15672; `guest/guest` em localhost; env `RABBITMQ_DEFAULT_USER/PASS`). Healthcheck: `rabbitmq-diagnostics -q ping`.
- **R2 (aio-pika no Windows):** instala via uv; confirmar no `uv sync` da Tarefa 7 (fallback `pika` se houver atrito).

## Topologia (filas)

| Fila | Produtor | Consumidor | Payload (JSON) |
|------|----------|------------|----------------|
| `document.ingest` | `agent-service` (`POST /documents/ingest`) | `retrieval-service` (aio-pika) | `{ docId, projectId, text, metadata? }` |
| `telemetry.events` | `agent-service` (fim do `/chat`) | `memory-service` (`@RabbitListener`) | `{ conversationId, latencyMs, iterations, toolsUsed, ragHits, model, ts }` |

Default exchange (`""`), routing key = nome da fila, `durable=true`, ack manual/auto conforme o lado.

## Portas / infra nova

| Componente | Porta | Imagem | Notas |
|------------|-------|--------|-------|
| RabbitMQ (AMQP) | 5672 | `rabbitmq:3-management` | broker |
| RabbitMQ (UI) | 15672 | idem | management UI (guest/guest em dev) |

## Critérios de aceite

- [ ] **Ingestão async:** `POST /documents/ingest` → 202; após o consumer processar, `/search` acha o doc.
- [ ] **Desacoplamento demonstrável:** com o consumer parado, a mensagem fica na fila (visível na UI 15672) e é processada quando ele volta.
- [ ] **Telemetria:** cada `/chat` gera 1 linha em `telemetry_event` (Postgres); a resposta do `/chat` não fica mais lenta perceptivelmente.
- [ ] **Resiliência:** broker fora → `/chat` continua respondendo (telemetria best-effort); `/documents/ingest` responde 503 claro.
- [ ] **Discovery/gateway:** `/documents/**` roteia via `lb://agent-service`.
- [ ] **Builds verdes:** `mvn package` em agent-service e memory-service; retrieval sobe com o consumer.
- [ ] Docs + ADR 0010.

## Riscos / decisões em aberto

- **R1 — Interop de tipos JSON (Spring→Spring).** `__TypeId__` acopla pacotes; mitigado com
  `TypePrecedence.INFERRED` no consumer. ADR 0010.
- **R2 — aio-pika no Windows.** Confirmar na Tarefa 1; fallback `pika` (síncrono em thread) se houver atrito.
- **R3 — Telemetria bloqueando.** Publicar após montar a resposta, em try/catch; nunca aguardar consumo.
- **R4 — Ordering/perda.** Filas duráveis + ack; sem DLQ/retry sofisticado (evolução). Para o MVP, perda eventual de telemetria é tolerável.
- **R5 — Credenciais.** `guest/guest` só funciona em localhost; externalizar `RABBITMQ_*` para Compose/K8s (Entrega 5).
- **R6 — Idempotência da ingestão.** `docId` fixo + upsert no Chroma já dá idempotência por doc (reprocessar não duplica).

## Verificação (passo a passo)

```bash
# 1) Infra (inclui RabbitMQ)
docker compose -f infra/docker-compose.infra.yaml up -d
# UI: http://localhost:15672 (guest/guest) -> filas document.ingest, telemetry.events

# 2) Ingestão assíncrona (via gateway)
curl http://localhost:8080/documents/ingest -H "Content-Type: application/json" \
  -d "{\"docId\":\"async1\",\"projectId\":\"p1\",\"text\":\"Documento ingerido pela fila RabbitMQ.\"}"
# -> 202; consumer do retrieval loga a indexacao; depois:
curl http://localhost:8083/search -H "Content-Type: application/json" -d "{\"query\":\"fila RabbitMQ\",\"topK\":3}"

# 3) Telemetria
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"conversationId\":\"c-tel\",\"message\":\"Quanto e 2+2?\"}"
docker exec -it postgres psql -U postgres -d memory -c "SELECT conversation_id, latency_ms, iterations, rag_hits FROM telemetry_event ORDER BY id DESC LIMIT 5;"

# 4) Desacoplamento: parar o retrieval-service, publicar 2 docs, ver acumular na UI 15672,
#    subir o retrieval -> filas drenam e /search passa a achar.
```
