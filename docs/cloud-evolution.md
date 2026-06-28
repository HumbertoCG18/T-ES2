# Análise de evolução para nuvem (entregáveis g + h)

Como a arquitetura implementada evoluiria para **produção em nuvem sobre Kubernetes**, identificando
os componentes que precisariam de **substituição** (por serviços gerenciados) ou **escalabilidade
adicional**. A execução **local** continua sem nuvem (Docker Compose); a restrição "local sem nuvem"
vale para o desenvolvimento — em produção, usar serviços de nuvem é desejável.

> **Vantagem de partida:** toda a config já é **externalizada por env** (ADR 0012). O mesmo artefato
> (imagens) serve ao Compose e ao K8s (`../k8s/`); migrar para serviços gerenciados é, na maioria dos
> casos, **só trocar uma variável de ambiente** (URL/host).

## (g) Componentes: substituir (gerenciado) vs escalar

| Componente | Hoje (local/K8s) | Em produção (nuvem) | Ação |
|------------|------------------|---------------------|------|
| PostgreSQL (memória longa) | container + PVC | **RDS / Cloud SQL** (HA, backups, PITR) | **Substituir** (`POSTGRES_URL`) |
| Redis (memória curta) | container + PVC | **ElastiCache / Memorystore** | **Substituir** (`REDIS_HOST`) |
| RabbitMQ (mensageria) | container + PVC | **Amazon MQ / CloudAMQP** ou operador no cluster | **Substituir** (`RABBITMQ_HOST`) |
| ChromaDB (vetorial/RAG) | container + PVC | vetorial gerenciado (**Qdrant Cloud/Pinecone**) ou self-hosted com volume | **Substituir/avaliar** (`CHROMA_HOST`) |
| Ollama (LLM local) | container (CPU) | **node pool com GPU** ou **endpoint de LLM hospedado** | **Escalar (GPU) ou substituir** |
| llm-gateway (LiteLLM) | container | mantém (abstrai o provedor) — troca de LLM é só config | **Manter** |
| name-server (Eureka) | container | **discovery nativo do K8s** (Services + DNS) → remover Eureka e o client | **Substituir** |
| api-gateway | container | atrás de **Ingress + cloud LB**, ou API Gateway gerenciado | **Manter + expor** |
| Jaeger (tracing) | container | **tracing gerenciado** (X-Ray / Grafana Tempo / Honeycomb) via OTLP | **Substituir** (OTLP endpoint) |
| agent/retrieval/tool-registry | stateless | escalam horizontalmente (HPA) | **Escalar** |

## Escalabilidade

- **Serviços stateless** (`agent-service`, `retrieval-service`, `tool-registry`, `api-gateway`,
  `llm-gateway`): escala **horizontal** com **HPA** (CPU/latência/RPS). O `agent-service` é o candidato
  principal (caminho quente do `/chat`).
- **Stateful** (Postgres/Redis/RabbitMQ/Chroma): delegar escala/HA aos **serviços gerenciados**
  (réplicas de leitura, cluster, multi-AZ) em vez de gerir StatefulSets.
- **Ollama/LLM**: o gargalo. Escala **vertical** (GPU) e/ou réplicas em node pool dedicado; ou trocar
  por um endpoint de inferência gerenciado (mantendo o `llm-gateway` como ponto único de abstração).
- **Mensageria**: o RabbitMQ desacopla picos (ingestão/telemetria); o consumidor (retrieval) escala
  por profundidade de fila.

## Resiliência e disponibilidade

- **Múltiplas réplicas** dos serviços stateless + **PodDisruptionBudget**; **multi-AZ** nos gerenciados.
- **Circuit breakers** (já implementados) + **probes** (readiness/liveness, nos manifests) → o cluster
  reinicia/retira pods não saudáveis do balanceamento.
- **Discovery:** se mantiver o Eureka, **religar `eureka.server.enable-self-preservation: true`** em
  produção — em dev ele foi **desligado** (poucas instâncias disparavam o modo de proteção
  indevidamente, banner "EMERGENCY"). O self-preservation protege contra remover instâncias vivas
  durante blips de rede — cenário real só na nuvem. Migrar para Services/DNS do K8s elimina esse ponto.

## Segurança

- **Secrets**: do `Secret` do K8s para um **gerenciador** (AWS Secrets Manager / GCP Secret Manager)
  via External Secrets; nada de senha em texto no repositório.
- **Rede**: `NetworkPolicy` restringindo tráfego (só o gateway exposto); **TLS** no Ingress; mTLS
  opcional (service mesh).
- **Gateway**: **rate limiting** (já implementado) + autenticação/autorização (a adicionar) na borda.
- **Imagens**: registry privado, *scan* de vulnerabilidades, `imagePullPolicy: Always` com tags imutáveis.

## Observabilidade

- O tracing já é **OTLP** (padrão): apontar `OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_ENDPOINT` para um
  coletor gerenciado — troca de config, sem mudança de código. Acrescentar **métricas**
  (Prometheus/Grafana ou gerenciado) e **logs** centralizados.

## (h) Resumo das alterações necessárias

1. **Manifests K8s** (`../k8s/`): Namespace, ConfigMap/Secret, Deployments/Services dos 7 serviços +
   infra + Jaeger, PVCs e Ingress (api-gateway) — **já entregues** (`kubectl kustomize k8s/` válido, 35 recursos).
2. **Imagens num registry** (em vez de locais `tes2-*`) + tags imutáveis.
3. **Trocar a infra por serviços gerenciados** (env: Postgres/Redis/RabbitMQ/Chroma/Jaeger).
4. **LLM**: node GPU para o Ollama **ou** endpoint hospedado atrás do `llm-gateway`.
5. **Discovery**: opcionalmente remover o Eureka e usar DNS do K8s (ou religar o self-preservation).
6. **HPA** nos serviços stateless; **Secrets gerenciados**; **NetworkPolicy**/TLS; **CI/CD** para deploy.

> Cluster rodando **não é exigido** pela spec — bastam a descrição + os manifests. Demonstração real é
> opcional (Kind/Minikube/Docker Desktop habilitam um K8s local).
