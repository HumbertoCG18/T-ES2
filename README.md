# T-ES2 — Plataforma de Agentes Conversacionais

Trabalho Final de Engenharia de Software II. Plataforma de microsserviços para execução de
agentes de IA conversacionais (ciclo **raciocínio → ação → observação**), rodando localmente
sem dependência de nuvem. Especificação completa em [`docs/t1_2026_1.pdf`](docs/t1_2026_1.pdf).

> **Novo no projeto?** Comece pelo [**Guia do Sistema**](docs/GUIA-DO-SISTEMA.md) — explica o que é,
> o que foi construído, o que instalar e como rodar, do zero.

## Estado atual — Entregas 1–7 concluídas (dev/infra completo)

Os **7 microsserviços** da spec existem e a plataforma sobe inteira com **`docker compose up`**
(containers + infra + Ollama + Jaeger), com tracing distribuído (OTel→Jaeger), CI (GitHub Actions)
e manifests Kubernetes (`k8s/`). Falta só a **Entrega 8** (relatório + vídeo + apresentação,
englobando diagrama, benchmarks e discussão de riscos).

| Serviço | Papel | Stack | Porta |
|---------|-------|-------|-------|
| `agent-service` | Ciclo agêntico (LLM + ferramentas) | Spring Boot | 8081 |
| `llm-gateway` | Proxy p/ LLM local | LiteLLM + Ollama | 4000 |
| `memory-service` | Memória curta (Redis) + longa (PostgreSQL) | Spring Boot | 8082 |
| `retrieval-service` | RAG (busca semântica + ingestão) | FastAPI + ChromaDB | 8083 |
| `tool-registry` | 7 ferramentas remotas | Spring Boot | 8084 |
| `api-gateway` | Entrada única (roteamento + rate limit) | Spring Cloud Gateway | 8080 |
| `name-server` | Service discovery | Eureka Server | 8761 |

## Rodar tudo (Docker Compose) — recomendado

```bash
docker compose build                 # 1a vez (~minutos)
docker compose up -d                 # sobe os 7 serviços + infra + Ollama + Jaeger
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull embeddinggemma:300m
curl http://localhost:8080/chat -H "Content-Type: application/json" -d '{"message":"oi"}'
# Eureka :8761 · RabbitMQ :15672 (guest/guest) · Jaeger :16686
```

## Pré-requisitos

| Ferramenta | Versão testada |
|------------|----------------|
| Java (JDK) | 21+ (testado em 25) |
| Maven      | 3.9+ (ou use o `mvnw` gerado) |
| Python     | 3.11+ com [uv](https://docs.astral.sh/uv/) |
| Ollama     | com modelo `llama3.1` baixado |

## Rodar em modo dev (processos locais) — alternativa

Sem containers, para iterar com hot-reload. Abra **3 terminais** (não rodar junto com o Compose —
mesmas portas).

**1. Ollama** (modelo de linguagem local)
```bash
ollama serve          # normalmente já roda como serviço no Windows
ollama pull llama3.1  # uma vez, se ainda não tiver
```

**2. llm-gateway** (porta 4000)
```bash
cd llm-gateway
# PowerShell:  $env:OLLAMA_BASE_URL="http://localhost:11434"
uv run litellm --config config.yaml --port 4000
```

**3. agent-service** (porta 8081)
```bash
cd agent-service
./mvnw spring-boot:run      # Windows: .\mvnw.cmd spring-boot:run
```

## Testar o ciclo agêntico

```bash
curl http://localhost:8081/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Quanto e (12 + 8) * 3? Use a calculadora."}'
```

Resposta esperada: JSON `{ "reply": "...", "trace": ["acao: calculator(...) -> 60", ...] }`.
O campo `trace` mostra as ferramentas invocadas no ciclo.

## Build e testes

```bash
cd agent-service
./mvnw test        # roda os testes (não precisa do gateway/Ollama)
./mvnw package     # gera o jar em target/
```

## Roadmap (entregas)

1. ✅ **Fundação** — agent-service + llm-gateway via REST.
2. ✅ **Infraestrutura** — Eureka (name-server) + API Gateway + circuit breaker (verificada ao vivo).
3. ✅ **Memória e RAG** — memory-service (Redis curto prazo + PostgreSQL longo prazo) +
   retrieval-service (FastAPI + ChromaDB) com ingestão/busca semântica. Integrado ao `/chat`
   (`conversationId`, histórico + contexto RAG no `trace`), verificado ponta-a-ponta ao vivo.
4. ✅ **Mensageria** — RabbitMQ com **dois** fluxos assíncronos: ingestão de documentos
   (`/documents/ingest` → fila → retrieval-service indexa) e telemetria (`/chat` → fila →
   memory-service persiste `telemetry_event`). Desacoplamento e resiliência verificados ao vivo.
5. ✅ **Containerização** — Dockerfile por serviço (5 Spring multi-stage, 2 Python slim+uv) +
   `docker-compose.yaml` na raiz orquestrando os 7 serviços + infra + Ollama. `docker compose up`
   sobe a plataforma toda (config por env, descoberta por nome/`lb://`); verificado ao vivo
   (7 imagens, 12 containers, Eureka in-container UP).
6. ✅ **Observabilidade** — rastreamento distribuído OpenTelemetry → Jaeger (5 serviços, incl.
   Java↔Python via `retrieval-service`); Jaeger no compose (UI :16686). + pipeline de CI
   (GitHub Actions: Java/Python/frontend). Verificado ao vivo.
7. ✅ **Produção em nuvem** — manifests Kubernetes em `k8s/` (7 serviços + infra + Jaeger + Ingress;
   ConfigMap/Secret/PVC; `kubectl kustomize` válido, 35 recursos) + análise de evolução para nuvem
   ([`docs/cloud-evolution.md`](docs/cloud-evolution.md)). Cluster rodando é opcional.
8. 🔨 Entrega final — relatório técnico + vídeo (YouTube não-listado) + apresentação. Roteiro passo
   a passo em [`docs/plan/08-entrega-final.md`](docs/plan/08-entrega-final.md).

> **`tool-registry` (microsserviço nº 5 da spec)** ✅ — serviço remoto (8084) com **7 ferramentas**
> (calculator, datetime, db_query, knowledge_search, unit_convert, text_stats, random); o
> agent-service as consome por `lb://` com circuit breaker. Com isso, **os 7 microsserviços existem**.
>
> **Capacidades extras** ✅ — rate limiting no gateway (HTTP 429), toggles de memória/RAG por conversa
> (+ ver/limpar memória), saúde dos serviços ao vivo, upload de arquivo → indexação RAG, **controles
> do agente no input do chat (modelo · esforço · modo raciocínio) que chegam ao `/chat`** e mudam o
> comportamento de verdade (orçamento de iterações + temperatura + raciocínio passo a passo no
> `trace`), citações das fontes nas respostas.

**Bônus (apoio à demo) — `frontend/`:** 🔨 app web estilo claude.ai (Vite + React + Tailwind +
shadcn) consumindo `POST /chat` via gateway. Já feito: app shell + **views dedicadas Conversas /
Projetos / Capacidades**, favoritos (projetos e chats), agrupamento de conversas por projeto,
busca, configurações (tema, fonte, tipo de resposta, instruções), chat com markdown/LaTeX/**blocos
de código**, **timeline** do ciclo agêntico (Pensamento vs passos), **citações**, **citar trecho**
da resposta, editar/regenerar/copiar, anexos, **controles do agente no input do chat — modelo ·
esforço (Rápido/Equilibrado/Profundo) · modo raciocínio — estilo Claude Code, ligados ao `/chat`**,
projetos (instruções/memória/arquivos com **barra de capacidade** e excluir projeto), e aba
**Infraestrutura** nas configurações (Entregas 4–7 visíveis, com link para RabbitMQ/Jaeger). **Polido em 3 passes** (design tokens semânticos, estados/skeletons,
mobile/a11y, **logomark próprio**). Verificado ao vivo com LLM real + tool calling. Status em
[`docs/plan/B-frontend.md`](docs/plan/B-frontend.md).

Rodar o frontend (com a plataforma no ar):
```bash
cd frontend
npm install     # primeira vez
npm run dev     # http://localhost:5173 (proxy /api -> gateway 8080)
```

## Entregáveis não-código (checklist — valem nota, fáceis de esquecer)

- ⬜ **Diagrama de arquitetura** — serviços, responsabilidades, protocolos de comunicação.
- ⬜ **Relatório técnico** — metodologia, decisões + justificativas, trade-offs, dificuldades,
  conclusões.
- ⬜ **Avaliação de desempenho** — experimentos/benchmarks (latência, throughput) com
  interpretação crítica dos resultados.
- ⬜ **Discussão de riscos** — segurança, performance, escalabilidade, disponibilidade.
- ✅ **Análise de evolução para nuvem** + descrição das alterações para Kubernetes
  ([`docs/cloud-evolution.md`](docs/cloud-evolution.md) + `k8s/`).
- 🔨 **Circuit breaker demonstrado** — código pronto (fallback agent→llm-gateway/memory/retrieval);
  falta só gravar o cenário (ex.: llm-gateway fora do ar) no vídeo.
- ⬜ **Vídeo de demonstração** (YouTube não-listado) + apresentação final.
