# ADR 0015 — Controles do agente por requisição (modelo · esforço · raciocínio) no composer

**Status:** Aceito · **Data:** 2026-06-28

## Contexto

O frontend permitia escolher o **modelo** em dois lugares (a *top bar* do chat e a aba "Modelo"
das Configurações) — duplicação ambígua. A UX de referência (Claude Code) coloca os controles do
agente **no próprio input do chat**, e o usuário pediu também **esforço** e **modo raciocínio
(thinking)**, "entre outras coisas interessantes".

O `/chat` já recebia `model` (mapeado para o modelo lógico do `llm-gateway`), mas a **temperatura**
vinha fixa de `LlmProperties` (não por requisição) e não havia noção de esforço/raciocínio. Os
modelos locais (`llama3.1`, `gemma3:4b` via Ollama) **não** têm canal de "thinking" nativo nem
parâmetro de "reasoning effort" como os modelos de raciocínio — mas ambos podem ser implementados
de forma **real** (não cosmética) com os mecanismos que a plataforma já tem: o orçamento de
iterações do ciclo agêntico, a temperatura e o system prompt.

## Decisão

- **Consolidar a seleção no composer.** Os controles do agente passam para a barra inferior do
  input (estilo Claude Code): **modelo**, **esforço** e **raciocínio**. Removido o `ModelSelector`
  da *top bar* (`TopBar`), da aba "Modelo" das Configurações (`SettingsDialog`) e do header de
  `ProjectView` — fim da ambiguidade. Fonte única de seleção: o composer.
- **`/chat` ganha dois campos por requisição** (além de `model`):
  - `effort`: `"rapido" | "equilibrado" | "profundo"`.
  - `thinking`: `boolean`.
- **`effort` é real** (`AgentLoop.effortPolicy`): mapeia para **orçamento de iterações** do ciclo
  agêntico e **temperatura**, com base no limite configurado `llm.max-iterations` (`base`):
  - `rapido` → `max(2, base/2)` iterações, temperatura `0.0`;
  - `equilibrado` → `base` iterações, temperatura `0.1` (padrão);
  - `profundo` → `min(12, base*2)` iterações, temperatura `0.3`.

  A temperatura passou a ser **por requisição**: `LlmClient.complete(...)` recebe `temperature`
  (antes usava só `LlmProperties.temperature()` como fallback) e a repassa no
  `ChatCompletionRequest` ao gateway.
- **`thinking` é real:** quando ligado, anexa um trecho ao system prompt pedindo raciocínio passo a
  passo — a resposta começa com uma seção `Raciocinio:` (2–4 passos) seguida de `Resposta:`.
- **Demonstrável no `trace`:** toda resposta ganha as linhas `esforco: <nível> (orcamento N
  iteracoes, temperatura T)` e, com thinking ligado, `modo raciocinio: ligado` — visíveis na
  timeline do frontend (insumo da Entrega 8).
- **Persistência no frontend:** `model`, `effort` e `thinking` ficam em `Settings` (localStorage);
  `store.runAgent` os envia em todo `/chat`. O `sanitize` do store passou a restaurar todos os
  campos de `Settings` (corrige um *bug* latente em que fonte/apelido/instruções resetavam no
  reload).

## Consequências

**Prós**
- Controle do agente no input, estilo Claude Code; uma única fonte de seleção (sem ambiguidade
  top bar vs. configurações).
- `effort` e `thinking` **mudam o comportamento de verdade** (orçamento de iterações + temperatura
  + raciocínio passo a passo), não são enfeite de UI.
- Verificado ao vivo (Docker Compose, `llama3.1` local): com **Profundo + Pensar**, o `trace`
  mostrou `orcamento 10 iteracoes, temperatura 0.3` + `modo raciocinio: ligado`, a resposta veio com
  `Raciocinio:`/`Resposta:` e a ferramenta `calculator` ancorou `(12 + 8) * 3 → 60` (resposta final
  na iteração 2).

**Contras / trade-offs**
- O "modo raciocínio" em modelo local é obtido **via prompt** (a resposta expõe os passos), não por
  um canal de *reasoning* separado como nos modelos dedicados — o raciocínio fica embutido no texto.
- Esforço alto = **mais iterações** = mais latência (aceitável: é a escolha explícita do usuário; o
  `TimeLimiter` do breaker continua protegendo).
- Temperatura mais alta no `profundo` (0.3) pode aumentar o risco de *tool-call* espúrio do modelo
  local; mitigado pelo **gating** `needsTools` (ADR 0011), que só oferece ferramentas quando a
  mensagem tem dígito/palavra-chave.
- Contrato do `/chat` cresceu (mais dois campos opcionais); ausentes, o comportamento é o padrão
  (`equilibrado`, sem thinking) — back-compat preservada.
