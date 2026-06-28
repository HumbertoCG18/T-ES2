# ADR 0014 — Produção em nuvem: manifests Kubernetes (paridade com o Compose) + evolução

**Status:** Aceito · **Data:** 2026-06-28

## Contexto

A spec (entregáveis g + h, Entrega 7) pede a **descrição das alterações** para rodar em Kubernetes e
os **manifests YAML** (cluster rodando é **opcional**), além de uma **análise de evolução para nuvem**.

## Decisão

- **Manifests K8s em `k8s/`** reusando as **mesmas imagens** (`tes2-*`) e a **mesma config por env**
  da Entrega 5: `Namespace`, `ConfigMap`+`Secret`, `Deployment`+`Service` dos 7 serviços + infra
  (Redis/Postgres/ChromaDB/RabbitMQ/Ollama) + Jaeger, `PersistentVolumeClaim` para o estado, e
  `Ingress` expondo só o `api-gateway`. Agregados por `kustomization.yaml`.
- **Paridade Compose ↔ K8s:** só muda a orquestração. Serviços resolvem-se por **DNS do K8s** (nome do
  Service) e por **`lb://` via Eureka** — mesmas variáveis (`EUREKA_URL`, `LLM_BASE_URL`, `POSTGRES_URL`,
  `OTLP_ENDPOINT`, `SERVICE_HOST=retrieval-service`). Graças à config 100% externalizada (ADR 0012),
  o mesmo artefato serve aos dois.
- **Probes** (readiness/liveness: actuator `/health` nos Spring, `/health` no retrieval, TCP na infra/Eureka)
  e **requests/limits** básicos. `imagePullPolicy: IfNotPresent` (imagens locais; em cluster real, registry).
- **Eureka mantido por paridade;** a **análise de evolução** ([`../cloud-evolution.md`](../cloud-evolution.md))
  descreve substituí-lo por discovery nativo do K8s e trocar a infra por **serviços gerenciados**
  (RDS/ElastiCache/Amazon MQ/vetorial gerenciado), além de GPU para o Ollama e HPA nos stateless.
- **Validação sem cluster:** `kubectl kustomize k8s/` (35 recursos) — `kubectl apply` real precisa de
  cluster (opcional pela spec).

## Consequências

**Prós**
- Migração Compose → K8s é majoritariamente **config** (env), não código — a externalização paga aqui.
- Só o gateway exposto (Ingress); estado com PVC; probes para o cluster gerir saúde.
- Caminho claro para produção (cloud-evolution.md): o que vira gerenciado, o que escala (HPA), segurança.

**Contras / trade-offs**
- **Imagens locais** (`tes2-*`): num cluster real precisam de registry — documentado.
- **Ollama em K8s** é pesado (GPU/VRAM); CPU é inviável para produção — documentado (node GPU ou hosted).
- **Eureka redundante** com o discovery do K8s; mantido por paridade, mas a evolução recomenda removê-lo.
- **PVC depende do StorageClass** do cluster; em produção, preferir serviços gerenciados a StatefulSets.
