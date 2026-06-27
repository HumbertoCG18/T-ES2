# ADR 0007 — Memória de conversação em dois níveis: Redis (curto) + PostgreSQL (longo)

**Status:** Aceito · **Data:** 2026-06-27

## Contexto

A spec exige memória conversacional em **dois níveis**: curto e longo prazo. O `memory-service`
precisa guardar o histórico por `conversationId` e devolvê-lo rápido no caminho quente do `/chat`,
sem perder durabilidade entre reinícios.

## Decisão

- **PostgreSQL = fonte da verdade (longo prazo).** Cada turno persistido em tabela relacional
  (`conversation_message`), consultável e sobrevivente a restart. Schema via `ddl-auto: update`
  (Flyway fica para evolução futura).
- **Redis = cache da sessão ativa (curto prazo).** As últimas N mensagens numa **List**
  (`conv:{id}:messages`), capada com `LPUSH`+`LTRIM 0 N-1` e com **TTL** (sessão).
- **Escrita = write-through:** ao anexar um turno, grava no Postgres **e** atualiza a List do Redis.
- **Leitura = Redis-first:** tenta o Redis; em *miss* (TTL expirou/cache frio) carrega as últimas N
  do Postgres e **reaquece** o Redis.
- **O que persistir:** o turno limpo (`user` + `assistant` final). As mensagens `tool`
  intermediárias do ciclo agêntico ficam **efêmeras** (não poluem o histórico re-injetado no LLM).
- O Redis é **só cache**: qualquer falha nele é logada e ignorada (o Postgres já garantiu o dado).

## Consequências

**Prós**
- Os dois níveis ficam **demonstráveis**: derrubar o Redis → histórico continua vindo do Postgres;
  inspecionar a key (`LRANGE`) → mostra a sessão quente; `SELECT` → mostra o durável.
- Leitura quente rápida sem bater no banco a cada turno.

**Contras / trade-offs**
- Consistência eventual entre os dois níveis em janelas de falha do Redis (aceitável: Postgres manda).
- `ddl-auto: update` não versiona o schema — adequado ao MVP; produção pediria Flyway.
- Histórico re-injetado é capado em N (`memory.history-limit`, default 20) para não estourar a
  janela de contexto do modelo local (ver R3 do plano).
