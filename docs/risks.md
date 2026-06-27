# Discussão de riscos e oportunidades de melhoria

> Exigido pela spec (entrega final): discussão de oportunidades de melhoria e riscos abrangendo
> segurança, performance, escalabilidade e disponibilidade. Preencher ao longo do projeto.

## Segurança

- [ ] Gateway sem autenticação no MVP — em produção, exigir auth (API key / OAuth2) no
  `api-gateway`.
- [ ] LiteLLM exposto sem chave; restringir acesso à rede interna.
- [ ] Validação de entrada / prompt injection no `agent-service`.
- [ ] Segredos (credenciais de DB) externalizados — nunca no código.

## Performance

- [ ] Inferência local limitada por VRAM (4 GB) — gargalo do LLM.
- [ ] Telemetria assíncrona (RabbitMQ) evita bloquear a resposta ao cliente.
- [ ] Cache de respostas / memória de curto prazo (Redis) reduz chamadas repetidas.

## Escalabilidade

- [ ] Serviços stateless (`agent-service`, gateway) escalam horizontalmente; estado vive em
  Redis/PostgreSQL/RabbitMQ.
- [ ] `llm-gateway`/Ollama é o ponto mais difícil de escalar localmente (GPU única).
- [ ] RabbitMQ desacopla picos de ingestão de documentos do ritmo do consumidor.

## Disponibilidade

- [ ] Circuit breaker evita falha em cascata quando o LLM cai.
- [ ] Service discovery (Eureka) permite múltiplas instâncias por serviço.
- [ ] Pontos únicos de falha a mapear: name-server, gateway, broker.
