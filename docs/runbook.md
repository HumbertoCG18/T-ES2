# Runbook — subir e testar localmente

Guia operacional. Para a visão geral do projeto, ver o [`README.md`](../README.md) da raiz.

## Pré-requisitos (já instalados na máquina de dev)

Docker, JDK 21+ (testado em 25), Maven 3.9+, Python 3.11 + uv, Ollama (com `llama3.1`), Node.

## Subir (local, sem containers) — 3 terminais

```
1) Ollama:       ollama serve   (já roda como serviço no Windows)  +  ollama list
2) llm-gateway:  cd llm-gateway
                 $env:OLLAMA_BASE_URL="http://localhost:11434"
                 uv run litellm --config config.yaml --port 4000
3) agent-service: cd agent-service
                 .\mvnw.cmd spring-boot:run
```

## Testar o ciclo agêntico

```
curl http://localhost:8081/chat -H "Content-Type: application/json" ^
  -d "{\"message\":\"Quanto e (12 + 8) * 3? Use a calculadora.\"}"
```

Esperado: `{ "reply": "...", "trace": ["acao: calculator(...) -> 60", ...] }`.

## Entrega 2 — Eureka + gateway + circuit breaker

Ordem de subida (4 terminais): **name-server → llm-gateway → agent-service → api-gateway**.

```
1) name-server:    cd name-server   && .\mvnw.cmd spring-boot:run     # 8761
2) llm-gateway:    (igual acima)                                       # 4000
3) agent-service:  cd agent-service && .\mvnw.cmd spring-boot:run     # 8081, registra no Eureka
4) api-gateway:    cd api-gateway   && .\mvnw.cmd spring-boot:run     # 8080, registra no Eureka
```

Provas:

```
# Dashboard do Eureka (navegador): AGENT-SERVICE e API-GATEWAY como UP
http://localhost:8761

# Acesso via gateway (discovery lb://, sem host/porta fixos)
curl http://localhost:8080/chat -H "Content-Type: application/json" ^
  -d "{\"message\":\"Quanto e (12 + 8) * 3?\"}"
```

Demonstrar o **circuit breaker** (não precisa de Ollama/LiteLLM): derrube o `llm-gateway`
(Ctrl+C no terminal 2) e chame via gateway — o `agent-service` devolve o fallback em vez de 5xx:

```
curl http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\":\"Oi\"}"
# Esperado: { "reply": "O servico de IA esta temporariamente indisponivel...", "trace": [...] }
```

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `Connection refused` na porta 4000 | gateway não subiu | conferir terminal do `litellm` |
| Gateway responde erro de modelo | modelo ausente no Ollama | `ollama pull llama3.1` |
| Resposta sem usar ferramenta | modelo sem tool calling confiável | usar `model: chat` (llama3.1), não `chat-light` |
| `/chat` trava muito tempo | inferência lenta (modelo grande na CPU) | trocar para `gemma3:4b` ou aumentar timeout |
| Porta 8081 ocupada | outra instância rodando | encerrar processo ou mudar `server.port` |

## Comandos úteis

```
cd agent-service && .\mvnw.cmd test        # testes (não precisa de gateway/Ollama)
cd agent-service && .\mvnw.cmd package      # gera target/agent-service-0.1.0.jar
ollama list                                 # modelos locais disponíveis
```
