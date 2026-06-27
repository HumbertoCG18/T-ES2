"""Consumer da fila document.ingest (RabbitMQ, Entrega 4).

Ingestão assíncrona: o agent-service publica documentos na fila; aqui consumimos no nosso
ritmo e indexamos no ChromaDB (mesma lógica do POST /ingest). Tolerante a falha: se o broker
estiver fora, o consumer não sobe e o serviço segue servindo /search e o /ingest síncrono.
"""

import json
import logging

import aio_pika

from app import rag_index
from app.config import settings

log = logging.getLogger("retrieval.consumer")

_connection = None


async def start() -> None:
    global _connection
    if not settings.messaging_enabled:
        log.info("Mensageria desabilitada (MESSAGING_ENABLED=false); consumer de ingestão off.")
        return
    try:
        _connection = await aio_pika.connect_robust(
            host=settings.rabbitmq_host,
            port=settings.rabbitmq_port,
            login=settings.rabbitmq_user,
            password=settings.rabbitmq_password,
        )
    except Exception as ex:  # noqa: BLE001 — degradação graciosa
        log.warning("RabbitMQ indisponível; consumer de ingestão off: %s", ex)
        _connection = None
        return

    channel = await _connection.channel()
    await channel.set_qos(prefetch_count=4)
    queue = await channel.declare_queue(settings.ingest_queue, durable=True)
    await queue.consume(_on_message)
    log.info("Consumindo fila '%s' (ingestão assíncrona).", settings.ingest_queue)


async def _on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    # requeue=False + catch interno: mensagem inválida é descartada (sem loop de poison message).
    async with message.process(requeue=False):
        try:
            payload = json.loads(message.body.decode())
            doc_id = payload["docId"]
            text = payload["text"]
            n = await rag_index.index_document(
                doc_id, text, payload.get("projectId"), payload.get("metadata")
            )
            log.info("Indexado via fila: docId=%s chunks=%d", doc_id, n)
        except Exception as ex:  # noqa: BLE001
            log.warning("Falha ao processar mensagem (descartada): %s", ex)


async def stop() -> None:
    global _connection
    if _connection is not None:
        await _connection.close()
        _connection = None
