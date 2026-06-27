# T-ES2 — Plataforma de Agentes Conversacionais

Trabalho Final de Engenharia de Software II. Plataforma de microsserviços para execução de
agentes de IA conversacionais (ciclo **raciocínio → ação → observação**), rodando localmente
sem dependência de nuvem. Especificação completa em [`docs/t1_2026_1.pdf`](docs/t1_2026_1.pdf).

## Estado atual — Entrega 1 (Fundação)

Dois serviços comunicando via REST, localmente, sem containers:

- **`llm-gateway/`** — LiteLLM expondo API OpenAI-compatível sobre o Ollama local.
- **`agent-service/`** — Spring Boot; recebe `POST /chat`, executa o ciclo agêntico com ≥1
  chamada ao LLM e ≥1 ferramenta (calculadora).

## Pré-requisitos

| Ferramenta | Versão testada |
|------------|----------------|
| Java (JDK) | 21+ (testado em 25) |
| Maven      | 3.9+ (ou use o `mvnw` gerado) |
| Python     | 3.11+ com [uv](https://docs.astral.sh/uv/) |
| Ollama     | com modelo `llama3.1` baixado |

## Como rodar (local)

Abra **3 terminais**.

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
2. ⬜ Infraestrutura — Eureka (name-server) + API Gateway + circuit breaker.
3. ⬜ Memória e RAG — memory-service (Redis + PostgreSQL) + retrieval-service (ChromaDB).
4. ⬜ Mensageria — RabbitMQ (fluxos assíncronos).
5. ⬜ Containerização — Dockerfiles + `docker-compose.yaml`.
6. ⬜ Observabilidade — OpenTelemetry + Jaeger; CI.
7. ⬜ Produção em nuvem — descrição/artefatos para Kubernetes.
8. ⬜ Entrega final — relatório técnico + vídeo.
