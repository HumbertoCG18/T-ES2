"""Consumer da fila document.ingest (RabbitMQ, Entrega 4).

Ingestão assíncrona: o agent-service publica documentos na fila; aqui consumimos no nosso
ritmo e indexamos no ChromaDB (mesma lógica do POST /ingest). Tolerante a falha: a conexão
é estabelecida numa task de background com retry infinito (fail_fast desligado, ver
_FAIL_FAST_OFF) — se o broker estiver fora no boot ou cair depois, o consumer se (re)conecta
sozinho e o serviço segue servindo /search e o /ingest síncrono enquanto isso. Mensagem em
falha de downstream é reenfileirada (não descartada); só a malformada é descartada.
"""

import asyncio
import json
import logging

import aio_pika
from opentelemetry import trace
from opentelemetry.propagate import extract

from app import rag_index
from app.config import settings

log = logging.getLogger("retrieval.consumer")

_tracer = trace.get_tracer("retrieval.consumer")


def _extract_context(message: aio_pika.abc.AbstractIncomingMessage):
    """Contexto de trace dos headers AMQP (traceparent W3C, publicado pelo agent-service
    com spring.rabbitmq.template.observation-enabled). Sem header → contexto vazio e o
    span do consumo vira raiz de um trace novo (comportamento antigo)."""
    headers = {}
    for k, v in (message.headers or {}).items():
        if isinstance(v, bytes):
            v = v.decode(errors="replace")
        headers[str(k)] = str(v)
    return extract(headers)

# ARMADILHA (aio-pika 9.x): kwargs extras do connect_robust são serializados na query da
# URL AMQP (make_url → yarl.URL.build), e o yarl rejeita bool — "Invalid variable type:
# value should be str, int or float". No destino, o aiormq faz parse_bool da string
# ("0"/"false"/etc → False; "1"/"true"/"yes" → True). Portanto TEM que ser string;
# `fail_fast=False` quebra o consumer em runtime (loop de retry com warning a cada 5 s).
# Detalhes no ADR 0010 (atualização 2026-07-05).
_FAIL_FAST_OFF = "0"

_connection = None
_task: asyncio.Task | None = None


async def start() -> None:
    global _task
    if not settings.messaging_enabled:
        log.info("Mensageria desabilitada (MESSAGING_ENABLED=false); consumer de ingestão off.")
        return
    # Não bloqueia o startup do FastAPI: broker fora do ar não atrasa o /search.
    _task = asyncio.create_task(_run(), name="ingest-consumer")


async def _run() -> None:
    global _connection
    while True:
        try:
            # fail_fast=False: tenta para sempre (cobre o boot antes do RabbitMQ ficar pronto).
            # Depois de conectada, a RobustConnection restaura canal/fila/consumer em quedas.
            _connection = await aio_pika.connect_robust(
                host=settings.rabbitmq_host,
                port=settings.rabbitmq_port,
                login=settings.rabbitmq_user,
                password=settings.rabbitmq_password,
                fail_fast=_FAIL_FAST_OFF,
                reconnect_interval=settings.rabbitmq_reconnect_seconds,
                client_properties={"connection_name": settings.service_name},
            )
            channel = await _connection.channel()
            await channel.set_qos(prefetch_count=4)
            queue = await channel.declare_queue(settings.ingest_queue, durable=True)
            await queue.consume(_on_message)
            log.info("Consumindo fila '%s' (ingestão assíncrona).", settings.ingest_queue)
            return
        except asyncio.CancelledError:
            raise
        except Exception as ex:  # noqa: BLE001 — retry: erro no setup não pode matar o consumer
            # Fecha conexão parcial antes de reatribuir no próximo loop (senão vaza um FD/TCP por
            # tentativa quando connect_robust sucede mas channel/declare_queue falha, ex.: 406).
            if _connection is not None:
                try:
                    await _connection.close()
                except Exception:  # noqa: BLE001 — best-effort
                    pass
                _connection = None
            log.warning(
                "Falha ao subir consumer de ingestão; nova tentativa em %ss: %s",
                settings.rabbitmq_reconnect_seconds,
                ex,
            )
            await asyncio.sleep(settings.rabbitmq_reconnect_seconds)


async def _on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    # Ack manual para separar dois tipos de falha:
    #  - malformada (JSON/campo faltando) = poison message → ack (descarta), senão loop infinito;
    #  - transitória de downstream (ChromaDB/embeddings fora) → nack requeue → reprocessa quando
    #    o downstream voltar. Antes tudo era ack+descarte: uma queda de 30s de Chroma perdia todos
    #    os docs em silêncio (achado na Entrega 8, seção 5.3 do relatório).
    # Span de consumo como filho do trace que publicou a mensagem (fecha o gap
    # produtor Java → consumidor Python no Jaeger).
    with _tracer.start_as_current_span(
        f"{settings.ingest_queue} process",
        context=_extract_context(message),
        kind=trace.SpanKind.CONSUMER,
    ) as span:
        try:
            payload = json.loads(message.body.decode())
            doc_id = payload["docId"]
            text = payload["text"]
        except (json.JSONDecodeError, UnicodeDecodeError, KeyError, TypeError) as ex:
            await message.ack()
            log.warning("Mensagem malformada descartada (poison): %s", ex)
            return

        span.set_attribute("document.id", doc_id)
        try:
            n = await rag_index.index_document(
                doc_id, text, payload.get("projectId"), payload.get("metadata")
            )
            await message.ack()
            log.info("Indexado via fila: docId=%s chunks=%d", doc_id, n)
            return
        except Exception as ex:  # noqa: BLE001 — downstream fora: reprocessa, não perde
            span.record_exception(ex)
            log.warning("Falha transitória ao indexar docId=%s; reenfileirando: %s", doc_id, ex)

    # Fora do span (o throttle não é trabalho de indexação): sleep antes do nack —
    # RabbitMQ reentrega imediato; sem isto vira loop quente durante a queda.
    await asyncio.sleep(settings.rabbitmq_reconnect_seconds)
    await message.nack(requeue=True)


async def stop() -> None:
    global _connection, _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001 — shutdown best-effort
            pass
        _task = None
    if _connection is not None:
        try:
            await _connection.close()
        except Exception:  # noqa: BLE001 — shutdown best-effort
            pass
        _connection = None
