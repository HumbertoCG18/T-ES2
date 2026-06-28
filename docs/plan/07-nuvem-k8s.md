# Plano — Entrega 7: Produção em nuvem (Kubernetes)

**Status:** ✅ Concluída (verificada ao vivo) · **Atualizado:** 2026-06-28

## Objetivo

Descrever e fornecer os **artefatos para rodar a plataforma em um cluster Kubernetes** (entregáveis
g + h da spec) — **manifests YAML** + uma **análise de evolução para nuvem**. A spec diz que ter um
cluster rodando é **opcional**; o foco é a descrição das alterações e os manifests válidos.

**Pronto** = (1) `k8s/` com manifests para os 7 serviços + infra + Jaeger (Deployments, Services,
ConfigMap/Secret, PVCs, Ingress); (2) `kubectl apply --dry-run=client -k k8s/` **válido**;
(3) doc com a **análise de evolução** (o que vira serviço gerenciado / o que escala) e as alterações
necessárias; (4) ADR 0014.

## Escopo

- **Inclui:**
  - **Manifests K8s** (`k8s/`): `Namespace`, `ConfigMap` (env compartilhado) + `Secret` (senha do
    Postgres), `Deployment`+`Service` para os 7 serviços e o Jaeger, e a infra
    (Redis/PostgreSQL/ChromaDB/RabbitMQ/Ollama) como `Deployment`+`Service`+`PersistentVolumeClaim`.
    `Ingress` expondo o `api-gateway`. `kustomization.yaml` agregando tudo.
  - **Probes**: `readiness`/`liveness` (actuator `/health` nos Spring; HTTP nos Python; TCP na infra).
  - **Recursos**: `requests`/`limits` básicos; `replicas` 1 (stateless podem escalar; HPA documentado).
  - **Descrição das alterações** (entregável h) + **análise de evolução para nuvem** (entregável g)
    em doc; ADR 0014.
  - Validação `kubectl --dry-run=client`. (Aplicar num cluster real é opcional.)
- **Não inclui:**
  - Subir um cluster real / cloud provider específico (opcional pela spec).
  - Helm chart (kustomize/`kubectl` é suficiente); service mesh; autoscaling configurado de fato.
  - Trocar Eureka por discovery nativo do K8s **no código** — mantém-se Eureka por paridade; a troca
    é **descrita** na análise de evolução.

## Decisões de design

### Paridade com o Compose — **mesmas imagens e env, agora em Deployments/Services**

- Reusa as imagens da Entrega 5 (`tes2-*`). Os serviços resolvem-se por **DNS do K8s** (nome do
  Service) e por **`lb://` via Eureka** — exatamente como no Compose (`EUREKA_URL`,
  `LLM_BASE_URL=http://llm-gateway:4000`, `POSTGRES_URL=jdbc:postgresql://postgres:5432/memory`,
  `OTLP_ENDPOINT=http://jaeger:4318/v1/traces`, `SERVICE_HOST=retrieval-service`). Mesmo artefato,
  só muda a orquestração (Compose → K8s), graças à config 100% por env.

### Estado e dados — **PVC para a infra; em produção, serviços gerenciados**

- Redis/Postgres/ChromaDB/RabbitMQ/Ollama com `PersistentVolumeClaim` (dados sobrevivem ao pod). Na
  **análise de evolução** recomenda-se troca por **serviços gerenciados** (RDS/Cloud SQL,
  ElastiCache/Memorystore, Amazon MQ/CloudAMQP, vetorial gerenciado) e nó com **GPU** para o Ollama
  (ou endpoint de LLM hospedado — respeitando que "local sem nuvem" vale para o dev, não a produção).

### Entrada — **Ingress no `api-gateway`** (único ponto externo)

- Só o `api-gateway` é exposto (Ingress/host). Os demais são `ClusterIP` (internos) — espelha o
  princípio "gateway é o único ponto de entrada".

### Discovery — **Eureka mantido; evolução descreve a troca**

- Mantém-se o `name-server` (Eureka) para paridade. A análise de evolução descreve substituí-lo por
  **discovery nativo do K8s** (Services + DNS), eliminando o `name-server` e o cliente Eureka.

## Tarefas

| # | Tarefa | Subagent | Arquivos | Depende de |
|---|--------|----------|----------|------------|
| 1 | **Namespace + Config:** `k8s/00-namespace.yaml`, `k8s/01-config.yaml` (ConfigMap env + Secret Postgres). | `general-purpose` | `k8s/00-*`, `k8s/01-*` | — |
| 2 | **Infra:** `k8s/10-infra.yaml` — Deployment+Service+PVC de Redis/Postgres/ChromaDB/RabbitMQ/Ollama + Jaeger. | `general-purpose` | `k8s/10-infra.yaml` | 1 |
| 3 | **Serviços:** `k8s/20-services.yaml` — Deployment+Service dos 7 serviços (env via ConfigMap/Secret; probes; imagens `tes2-*`). | `general-purpose` | `k8s/20-services.yaml` | 1,2 |
| 4 | **Ingress + kustomize:** `k8s/30-ingress.yaml` (api-gateway) + `k8s/kustomization.yaml` + `k8s/README.md`. | `cavecrew-builder` | `k8s/30-*`, `k8s/kustomization.yaml`, `k8s/README.md` | 3 |
| 5 | **Análise de evolução + ADR 0014:** `docs/cloud-evolution.md` (entregável g) + ADR 0014; atualizar `architecture.md`/`plan/README.md`. | `cavecrew-builder` | `docs/...` | — |
| 6 | **Verificação:** `kubectl apply --dry-run=client -k k8s/` válido. | thread principal | — | 1–4 |

## Critérios de aceite

- [ ] `kubectl apply --dry-run=client -k k8s/` (ou `-f`) sem erros para todos os manifests.
- [ ] Manifests cobrem os 7 serviços + infra + Jaeger + Ingress (api-gateway) + ConfigMap/Secret/PVC.
- [ ] Probes (readiness/liveness) e requests/limits básicos.
- [ ] Doc com **descrição das alterações** (h) + **análise de evolução para nuvem** (g) + ADR 0014.
- [ ] Config por env (paridade com o Compose); só o gateway exposto.

## Riscos

- **R1 — imagens `tes2-*` locais:** num cluster real precisariam de um registry. Documentar
  (`imagePullPolicy: IfNotPresent` + push para registry, ou Kind/Minikube com load).
- **R2 — Ollama em K8s:** pesado/lento sem GPU; em produção, nó GPU ou endpoint hospedado. Documentar.
- **R3 — Eureka vs DNS do K8s:** mantido por paridade; a troca por discovery nativo é descrita (não codada).
- **R4 — PVC/StorageClass:** depende do cluster; usar o `StorageClass` default.

## Verificação

```bash
kubectl apply --dry-run=client -k k8s/        # valida todos os manifests (sem aplicar)
# (opcional, cluster real) kubectl apply -k k8s/ ; kubectl -n tes2 get pods
```
