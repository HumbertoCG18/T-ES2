# Handoff — T-ES2 (Plataforma de Agentes Conversacionais)

**Branch:** `dev-HCG` · **Atualizado:** 2026-06-27 · **Trabalho Final de Engenharia de Software II**

Documento de transferência: leia isto + [`plan/README.md`](plan/README.md) ao retomar o projeto.

## TL;DR — onde estamos

Entregas **1 e 2 concluídas e verificadas ao vivo**. **Frontend bônus** (app shell completo
estilo claude.ai) funcionando ponta-a-ponta com LLM real + tool calling. **Entrega 3 (Memória e
RAG) está PLANEJADA** (plano pronto, ainda não implementada). **Próximo passo: executar a
Entrega 3** seguindo [`plan/03-memoria-rag.md`](plan/03-memoria-rag.md).

## Pronto (commits no `dev-HCG`)

| Commit | O quê |
|--------|-------|
| `bd5c90f` | Entrega 1 — `agent-service` + `llm-gateway` |
| `b99472d` | Entrega 2 — `name-server`, `api-gateway`, circuit breaker (verificada) |
| `e431829` | fix — Eureka self-preservation desligado em dev |
| `ec63edd` | frontend — app shell + features (markdown, LaTeX, código, timeline agêntica, projetos) |
| `b5a20a1`, `00d1710` | docs — roadmap, status, ADRs |

Working tree limpo. Sem push remoto (branch local).

## Serviços, portas e estado

| Serviço | Porta | Estado |
|---------|-------|--------|
| `name-server` (Eureka) | 8761 | ✅ pronto |
| `api-gateway` (Spring Cloud Gateway) | 8080 | ✅ pronto |
| `agent-service` (ciclo agêntico) | 8081 | ✅ pronto |
| `llm-gateway` (LiteLLM/Ollama) | 4000 | ✅ pronto |
| `frontend` (Vite/React) | 5173 | ✅ bônus |
| `memory-service` | 8082 | ⬜ Entrega 3 |
| `retrieval-service` | 8083 | ⬜ Entrega 3 |
| Redis / PostgreSQL / ChromaDB | 6379 / 5432 / 8000 | ⬜ Entrega 3 (containers) |
| Ollama | 11434 | infra local |

> Processos de dev de sessões anteriores podem ainda estar rodando nessas portas — matar se
> necessário (Windows: `Get-NetTCPConnection -LocalPort <p> -State Listen` → `Stop-Process`).

## Como rodar do zero

Pré-requisitos (já instalados na máquina de dev): Docker, JDK 21+ (testado em 25), Maven 3.9+,
Python 3.11 + uv, Ollama (`ollama pull llama3.1` e `embeddinggemma:300m`), Node.

Ordem mínima (ver [`runbook.md`](runbook.md) para detalhes e a demo de fallback da Entrega 2):
```
1) Ollama (serviço)         2) name-server (8761)     3) llm-gateway (4000)
4) agent-service (8081)     5) api-gateway (8080)
```
Frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173.
Smoke: `curl http://localhost:8080/chat -H "Content-Type: application/json" -d '{"message":"Quanto e 2+2?"}'`.

## Próximo passo — Entrega 3 (Memória e RAG)

Plano completo: [`plan/03-memoria-rag.md`](plan/03-memoria-rag.md). Resumo:
- **`memory-service`** (Spring, 8082): Redis (curto prazo) + PostgreSQL (longo prazo), por `conversationId`.
- **`retrieval-service`** (FastAPI + ChromaDB, 8083): ingestão + busca semântica; embeddings via `llm-gateway`.
- **`agent-service`**: `/chat` ganha `conversationId`; carrega histórico, injeta contexto RAG (vira passo no `trace`), persiste a troca.
- **Infra** via `infra/docker-compose.infra.yaml` (Redis/Postgres/ChromaDB em containers).
- **`tool-registry` adiado**; back-compat mantido (`/chat` sem `conversationId` funciona).

**Começar pela Tarefa 1 do plano** (Context7): confirmar starters `data-redis`/`data-jpa` + driver
Postgres no BOM Boot 3.5.9; API do `chromadb.HttpClient`; contrato `/v1/embeddings` do LiteLLM
(`{model,input}` → `data[].embedding`); viabilidade do `py-eureka-client` no Windows.

## Método de trabalho (SADD — Sub-Agent Driven Development)

[`plan/README.md`](plan/README.md) é a fonte de estado. Por entrega: **planejar** (`plan/NN-*.md`
via Plan agent) → **decompor e delegar** a subagents → **integrar e verificar** (thread
principal) → **atualizar status** + abrir ADR se houver decisão nova.

## Decisões de arquitetura (ADRs — [`adr/`](adr/))

0001 agent-service em Spring Boot · 0002 Boot 3.5.9 / Java 21 sobre JDK 25 · 0003 LLM local
(Ollama + LiteLLM) · 0004 frontend como bônus · 0005 circuit breaker via Spring Cloud
CircuitBreaker · 0006 stack do frontend.

## Gotchas (não repetir erros já resolvidos)

- **Circuit breaker:** usar **Spring Cloud CircuitBreaker** (factory programática), **não** a
  anotação `@CircuitBreaker`/`resilience4j-spring-boot3` — dá `NoClassDefFoundError` (skew de
  versão com o BOM). Ver ADR 0005.
- **Gateway starter** (Spring Cloud 2025.0.x) = `spring-cloud-starter-gateway-server-webflux`
  (o antigo `spring-cloud-starter-gateway` foi renomeado).
- **Eureka self-preservation** desligado em dev (poucas instâncias disparam o banner
  "EMERGENCY"); religar em produção.
- **Frontend ↔ backend:** o proxy do Vite `/api` precisa de `rewrite` removendo `/api` (a rota
  do gateway é `Path=/chat/**`; sem isso → 404).
- **Modelos `*-cloud` do Ollama são proibidos** (violam "local sem nuvem").
- **LLM local é lento** → time limiter do breaker `llmGateway` = 600s (default de 1s do Spring
  Cloud cortaria inferências legítimas).
- **Frontend:** seletor de modelo é cosmético (API `/chat` não recebe modelo); arquivos/memória/
  anexos de projeto são UI + localStorage até a Entrega 3 ligar o RAG.

## Pendências e riscos

- Entrega 3 a implementar (destrava arquivos de projeto / RAG no frontend).
- Entregas 4–8 não iniciadas (RabbitMQ, containers, observabilidade/CI, K8s, relatório+vídeo).
- Entregáveis **não-código** fáceis de esquecer (ver `plan/README.md` / `README.md`): diagrama,
  relatório com **benchmarks de desempenho**, discussão de riscos, vídeo não-listado.
- Sem push remoto — só o branch local `dev-HCG`.
