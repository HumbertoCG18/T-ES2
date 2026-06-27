# Experimentação e avaliação de desempenho

> Exigido pela spec: "práticas de experimentação, incluindo análise de trade-offs, avaliação de
> desempenho e interpretação crítica dos resultados". Preencher conforme os serviços ficam
> prontos. Não basta medir — **interpretar**.

## Metodologia (planejada)

- **Ferramenta de carga:** a definir (ex.: `hey`, `k6`, ou script `curl` em laço).
- **Ambiente:** máquina local (RTX 4050 4 GB, 32 GB RAM); registrar specs no relatório.
- **Repetições:** N execuções por cenário; reportar mediana + p95, descartar warm-up.

## Métricas

| Métrica | Como medir |
|---------|------------|
| Latência ponta-a-ponta (`/chat`) | p50 / p95 / p99 |
| Tempo de inferência do LLM | telemetria do `agent-service` (Entrega 4) |
| Throughput | requisições/s sob carga fixa |
| Overhead do gateway | latência com vs sem `api-gateway` no caminho |
| Impacto do circuit breaker | latência/erros com `llm-gateway` saudável vs derrubado |

## Cenários (a executar)

- [ ] Modelo `llama3.1` vs `gemma3:4b` — latência × qualidade.
- [ ] Caminho direto vs via `api-gateway` — custo do roteamento.
- [ ] Circuit breaker: comportamento e tempo de resposta com o LLM indisponível (fallback).
- [ ] Memória curto prazo (Redis) vs recuperação de longo prazo (PostgreSQL).
- [ ] RAG: latência da busca semântica conforme o número de documentos.

## Resultados

> Tabela a preencher: cenário · métrica · valor · observação.

## Interpretação crítica

> Discutir trade-offs observados (ex.: modelo maior = melhor resposta porém latência maior;
> gateway adiciona X ms mas centraliza resiliência). Relacionar com as decisões dos ADRs.
