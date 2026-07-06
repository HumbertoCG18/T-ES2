# Kubernetes — Plataforma de Agentes (Entrega 7)

Manifests para rodar a plataforma num cluster Kubernetes. **Mesmas imagens e config da Entrega 5**
(Docker Compose), agora como `Deployment`/`Service`/`ConfigMap`/`Secret`/`PVC`/`Ingress`. A spec diz
que um cluster rodando é **opcional**; o foco é a descrição + os manifests válidos.

## Estrutura

| Arquivo | Conteúdo |
|---------|----------|
| `00-namespace.yaml` | Namespace `tes2` |
| `01-config.yaml` | `ConfigMap` (env compartilhado) + `Secret` (senha do Postgres) |
| `10-infra.yaml` | Redis, PostgreSQL, ChromaDB, RabbitMQ, Ollama, Jaeger (Deployment+Service+PVC) |
| `20-services.yaml` | os 7 microsserviços (Deployment+Service; imagens `tes2-*`) |
| `30-ingress.yaml` | `Ingress` expondo só o `api-gateway` |
| `kustomization.yaml` | agrega tudo |

## Validar (sem cluster)

```bash
kubectl apply --dry-run=client -k k8s/
```

## Aplicar (cluster real — opcional)

Pré-requisitos: cluster (ex.: Kind/Minikube/Docker Desktop), Ingress Controller, e as imagens
`tes2-*` disponíveis no cluster.

```bash
# 1) Tornar as imagens locais visiveis ao cluster (exemplo Kind):
kind load docker-image tes2-name-server tes2-api-gateway tes2-agent-service \
  tes2-memory-service tes2-tool-registry tes2-llm-gateway tes2-retrieval-service
#    (ou publicar num registry e ajustar 'image:' nos manifests)

# 2) Aplicar
kubectl apply -k k8s/
kubectl -n tes2 get pods

# 3) Puxar os modelos do Ollama (uma vez, ficam no PVC)
kubectl -n tes2 exec deploy/ollama -- ollama pull llama3.1
kubectl -n tes2 exec deploy/ollama -- ollama pull embeddinggemma:300m

# 4) Acessar
#    - via Ingress: adicionar 'tes2.local' ao /etc/hosts apontando para o ingress
#    - ou port-forward:
kubectl -n tes2 port-forward svc/api-gateway 8080:8080
kubectl -n tes2 port-forward svc/jaeger 16686:16686
```

## Notas

- **Imagens locais:** `imagePullPolicy: IfNotPresent` + imagens `tes2-*` da Entrega 5. Num cluster
  gerenciado, publicar num registry (ECR/GCR/GHCR) e ajustar `image:`.
- **Ollama:** pesado/lento sem GPU — em produção, *node pool* com GPU (`resources.limits."nvidia.com/gpu"`)
  ou trocar por um endpoint de LLM hospedado. Modelos no PVC (GB).
- **Discovery:** mantém-se o Eureka (`name-server`) por paridade com o Compose. A evolução para nuvem
  (substituir por discovery nativo do K8s) está em [`../docs/cloud-evolution.md`](../docs/cloud-evolution.md).
- **Estado:** infra com PVC; em produção, trocar por serviços gerenciados (ver cloud-evolution).
