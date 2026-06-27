# ADR 0009 — Injeção de contexto RAG como system message dedicada, com degradação graciosa

**Status:** Aceito · **Data:** 2026-06-27

## Contexto

O `agent-service` precisa usar os documentos do usuário (RAG) sem reescrever a pergunta nem
"poluir" a mensagem do usuário, e sem quebrar quando a memória/RAG estiverem indisponíveis. Há que
decidir **como** montar o contexto do LLM e **como** isolar falhas dos serviços novos.

## Decisão

- **Ordem das mensagens:** `system` (prompt principal) → **histórico** recente (memory-service) →
  **`system` de contexto RAG** (se houver hits) → `user` (mensagem atual). A pergunta do usuário
  fica intacta; o RAG entra como material de apoio explícito ("use se for relevante; não invente").
- **Busca:** antes do loop, `RetrievalClient.search(userMessage, topK)`; cada hit vira uma linha do
  bloco de contexto. Adiciona-se ao `trace` a linha `"rag: N trechos recuperados"`, tornando a
  recuperação **visível** na timeline (o frontend já renderiza `trace`).
- **Persistência:** ao final do ciclo, `MemoryClient.appendTurn(user, assistant)` grava só o turno
  limpo (mensagens `tool` ficam efêmeras).
- **Resiliência:** memory e retrieval têm **breakers próprios** (`memoryService`, `retrievalService`)
  via o mesmo `CircuitBreakerFactory` do `LlmClient` (API programática; **não** a anotação — ver
  ADR 0005). Time limiter **curto** (memory 3s; retrieval 5s, pois encadeia um embedding). Em
  fallback: histórico vazio / sem contexto RAG / persistência pulada → o `/chat` **nunca** quebra
  por causa de memória/RAG.
- **Prompt:** o system prompt restringe o `calculator` a expressões aritméticas e instrui o modelo a
  responder direto do contexto recuperado quando a pergunta for sobre ele (reduz alucinação de
  tool-call do modelo local e melhora o *grounding*).

## Consequências

**Prós**
- RAG **demonstrável** (resposta ancorada no doc + linha no `trace`), verificado ao vivo (3/3
  respostas ancoradas após o ajuste de prompt).
- Falha de memória/RAG degrada para o comportamento da Entrega 2 (chat stateless), sem 5xx.

**Contras / trade-offs**
- O time limiter do breaker de retrieval (5s) cobre o embedding; corpora/modelos maiores pediriam revisão.

## Atualização (2026-06-27) — qualidade do chat com modelo local

O llama3.1 8B alucinava tool-calls (chamava o `calculator` até para "Teste") e o RAG injetava
`topK` trechos mesmo em mensagens irrelevantes. Mitigações implementadas:
- **Limiar de score no RAG** (`retrieval.min-score`, default 0.3): só injeta trechos com score de
  cosseno acima do limiar; "Teste" deixa de recuperar contexto sem sentido. (Substitui o "limiar
  fica para depois" do trade-off original.)
- **Gating de ferramenta:** o `calculator` só é oferecido ao LLM quando a mensagem contém dígito
  (`needsCalculator`). Sem aritmética, a ferramenta nem é enviada → o modelo não tem como alucinar
  a chamada. Resolve o problema na raiz para um modelo local fraco.
- **Temperatura baixa** (`llm.temperature`, default 0.0) + prompt conversacional explícito ("na
  maioria das mensagens, apenas converse, sem ferramentas").
- Verificado: "Teste" → resposta conversacional em 1 iteração (sem calculator/rag); aritmética usa
  o calculator; pergunta sobre o doc volta ancorada (Andromeda) sem passo de ferramenta espúrio.
