# ADR 0010 — Mensageria com RabbitMQ: ingestão assíncrona + telemetria

**Status:** Aceito · **Data:** 2026-06-27

## Contexto

A spec exige ≥1 fluxo assíncrono via RabbitMQ. Optou-se por **dois** (os exemplos canônicos):
ingestão de documentos e telemetria. Há que decidir topologia, interop Spring↔Python, onde mora
cada produtor/consumidor e como isolar falhas do broker.

## Decisão

- **Broker:** RabbitMQ (`rabbitmq:3-management`, 5672 + UI 15672) como container de infra.
- **Topologia simples para interop:** **default exchange** (`""`) + **filas duráveis nomeadas**
  (routing key = nome da fila). O único contrato entre os dois mundos é o **nome da fila**.
  Filas: `document.ingest` e `telemetry.events`. Mensagens em **JSON**.
- **Fluxo A — ingestão (polyglot):** produtor no `agent-service` (`POST /documents/ingest` →
  publica → **202 Accepted**; **503** se o broker estiver fora), exposto pelo `api-gateway`
  (`Path=/documents/**`). Consumidor no `retrieval-service` (**aio-pika** `connect_robust`, registrado
  no *lifespan* do FastAPI) → reusa `index_document()` (mesma lógica do `/ingest` síncrono) e indexa
  no ChromaDB. Tira a indexação (chunk+embed+upsert) do caminho síncrono.
- **Fluxo B — telemetria (não-bloqueante):** produtor no `agent-service` publica um evento ao fim de
  cada `/chat` (latência, iterações, ferramentas, hits de RAG, modelo) **best-effort** (falha de
  publicação é logada e ignorada — o `/chat` nunca quebra). Consumidor no `memory-service`
  (`@RabbitListener`) → persiste `telemetry_event` no Postgres (insumo para a avaliação de desempenho).
- **Sem 8º microsserviço:** a arquitetura tem 7 serviços fixos; os produtores/consumidores moram em
  serviços existentes (produtores no `agent-service`; consumidores no `retrieval-service` e
  `memory-service`).
- **Serialização JSON com `java.time`:** o `Jackson2JsonMessageConverter` recebe o **ObjectMapper do
  Boot** (com JavaTimeModule) — o `new Jackson2JsonMessageConverter()` default usaria um ObjectMapper
  cru, que falha em `Instant`.
- **Decoupling de tipos (Spring→Spring):** o produtor adiciona o header `__TypeId__` com a classe do
  pacote dele; o consumer usa `DefaultJackson2JavaTypeMapper` com `TypePrecedence.INFERRED` para
  desserializar para o tipo do parâmetro do `@RabbitListener`, ignorando o header.

## Consequências

**Prós**
- Desacoplamento **demonstrável** (verificado ao vivo): com o consumer parado, mensagens acumulam na
  fila durável (`rabbitmqctl list_queues` → `document.ingest messages=2`) e drenam quando ele volta.
- Telemetria persistida vira base para benchmarks (Entrega 8) sem custo no caminho do `/chat`.
- Interop Spring↔Python sem acoplamento de schema além do nome da fila + JSON.

**Contras / trade-offs**
- **Sem DLQ / retry sofisticado:** mensagem inválida no consumer de ingestão é descartada
  (`requeue=False` + catch) para evitar *poison message loop*; perda eventual de telemetria é
  tolerada (best-effort). Evolução: DLQ + retry/backoff.
- Stats do management API têm *lag* (~5s); para contagem autoritativa usar `rabbitmqctl list_queues`.
- `guest/guest` só em localhost; `RABBITMQ_*` externalizado para Compose/K8s (Entrega 5).
- Dois mecanismos AMQP (Spring AMQP e aio-pika) — custo de manter dois clientes, aceito para manter o
  `retrieval-service` em Python.
