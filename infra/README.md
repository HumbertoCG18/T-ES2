# Infraestrutura local — Entrega 3 (Memória e RAG)

Containers de **infra** (Redis, PostgreSQL, ChromaDB). Os serviços próprios
(`memory-service`, `retrieval-service`) rodam como **processos locais** nesta entrega —
Dockerfiles e o `docker-compose.yaml` completo chegam na **Entrega 5**.

## Subir / derrubar (recomendado)

```bash
docker compose -f infra/docker-compose.infra.yaml up -d     # sobe os 3 em background
docker compose -f infra/docker-compose.infra.yaml ps        # estado + healthchecks
docker compose -f infra/docker-compose.infra.yaml logs -f   # acompanhar logs
docker compose -f infra/docker-compose.infra.yaml down       # para (mantém os volumes/dados)
docker compose -f infra/docker-compose.infra.yaml down -v    # para E apaga os dados
```

| Serviço  | Porta | Imagem                  | Volume          | Uso              |
|----------|-------|-------------------------|-----------------|------------------|
| redis    | 6379  | `redis:7-alpine`        | `redis-data`    | curto prazo      |
| postgres | 5432  | `postgres:16-alpine`    | `postgres-data` | longo prazo (db `memory`) |
| chromadb | 8000  | `chromadb/chroma:1.5.3` | `chroma-data`   | vetores (RAG)    |
| rabbitmq | 5672 / 15672 | `rabbitmq:3-management` | `rabbitmq-data` | mensageria (Entrega 4) |

Postgres: db `memory`, user/pass `postgres`/`postgres`.
RabbitMQ: AMQP na 5672, UI em http://localhost:15672 (guest/guest em dev).

## Equivalentes em `docker run` (sem compose)

```bash
# Redis 7 (curto prazo)
docker run -d --name redis -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine redis-server --save 60 1 --appendonly no

# PostgreSQL 16 (longo prazo, db 'memory')
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=memory -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine

# ChromaDB 1.5.3 (vetores)
docker run -d --name chromadb -p 8000:8000 \
  -v chroma-data:/data \
  chromadb/chroma:1.5.3

# RabbitMQ 3 + management (mensageria, Entrega 4)
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 \
  -v rabbitmq-data:/var/lib/rabbitmq \
  rabbitmq:3-management
```

## Smoke checks

```bash
docker exec -it redis redis-cli ping                 # -> PONG
docker exec -it postgres pg_isready -U postgres -d memory
curl http://localhost:8000/api/v2/heartbeat          # -> {"nanosecond heartbeat": ...}
docker exec -it rabbitmq rabbitmq-diagnostics -q ping # -> Ping succeeded
```

Inspeção dos dois níveis de memória (após exercitar o `/chat`):

```bash
docker exec -it postgres psql -U postgres -d memory \
  -c "SELECT role, left(content,40) FROM conversation_message WHERE conversation_id='c-demo' ORDER BY id;"
docker exec -it redis redis-cli LRANGE conv:c-demo:messages 0 -1
```
