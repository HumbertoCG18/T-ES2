# Evolução para nuvem e migração para Kubernetes

> Entregáveis (g) análise de evolução para nuvem e (h) descrição das alterações para executar
> em cluster Kubernetes. Lembrar: a execução **local** não depende de nuvem; aqui descrevemos o
> que mudaria em produção.

## (g) Componentes que precisariam de substituição ou escala

| Componente local | Em produção (nuvem) | Motivo |
|------------------|---------------------|--------|
| Ollama (GPU única) | Nós com GPU gerenciados, ou LLM gerenciado atrás do mesmo gateway | VRAM local não escala |
| PostgreSQL (container) | Banco gerenciado (ex.: RDS / Cloud SQL) | Backup, HA, escala |
| Redis (container) | Cache gerenciado (ex.: ElastiCache / Memorystore) | HA, persistência |
| RabbitMQ (container) | Broker gerenciado ou operador no cluster | Durabilidade, escala |
| ChromaDB local | Qdrant/serviço vetorial gerenciado | Escala de índice |
| Eureka | Service discovery nativo do Kubernetes (Services/DNS) | K8s já resolve por DNS |
| `api-gateway` | Ingress + gateway, ou manter Spring Cloud Gateway | Entrada padronizada |

## (h) Alterações para rodar em Kubernetes

- [ ] **Manifests** por serviço: `Deployment` + `Service` (+ `HorizontalPodAutoscaler`).
- [ ] **ConfigMap / Secret** no lugar das env vars do Compose (config externalizada já pronta).
- [ ] **Service discovery:** trocar Eureka por DNS de `Service` do K8s (ou manter Eureka como
  está, decisão a justificar). Se mantiver o Eureka, **religar `enable-self-preservation: true`**
  em produção — em dev ele foi desligado (poucas instâncias disparavam o modo de proteção
  indevidamente). O self-preservation protege contra remover instâncias vivas durante blips de
  rede, cenário real só na nuvem.
- [ ] **Ingress** como entrada externa, à frente do `api-gateway`.
- [ ] **Estado:** Postgres/Redis/RabbitMQ via operadores ou serviços gerenciados (não rodar
  como Pods efêmeros sem volume).
- [ ] **Observabilidade:** OpenTelemetry Collector + Jaeger/Prometheus no cluster.
- [ ] **GPU:** node pool com GPU + `resources.limits` para o Ollama, ou migrar para LLM
  gerenciado.

> Cluster rodando **não é exigido** — basta a descrição + os manifests. Demonstração real é
> opcional (Docker Desktop habilita um K8s local).
