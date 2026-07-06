"""Registro no Eureka via py-eureka-client (no lifespan do FastAPI).

Nome lógico 'retrieval-service' → o agent-service resolve por lb://retrieval-service,
uniforme com os serviços Spring. Falha de registro NÃO derruba o serviço: cai-se para
a URL fixa no agent-service (RETRIEVAL_URL), com precedente no llm-gateway (R1/ADR 0008).
"""

import logging

from py_eureka_client import eureka_client

from app.config import settings

log = logging.getLogger("retrieval.eureka")


async def register() -> bool:
    if not settings.eureka_enabled:
        log.info("Eureka desabilitado (EUREKA_ENABLED=false); agent-service usará URL fixa.")
        return False
    health_url = f"http://{settings.service_ip}:{settings.service_port}/health"
    try:
        await eureka_client.init_async(
            eureka_server=settings.eureka_url,
            app_name=settings.service_name,
            instance_host=settings.service_host,
            instance_ip=settings.service_ip,
            instance_port=settings.service_port,
            should_discover=False,          # só registra; não precisa puxar o registro
            status_page_url=health_url,
            health_check_url=health_url,
        )
        log.info("Registrado no Eureka como %s (porta %d).",
                 settings.service_name, settings.service_port)
        return True
    except Exception as ex:  # noqa: BLE001 — degradação graciosa
        log.warning("Falha ao registrar no Eureka (%s); seguindo sem discovery: %s",
                    settings.eureka_url, ex)
        return False


async def deregister() -> None:
    if not settings.eureka_enabled:
        return
    try:
        await eureka_client.stop_async()
        log.info("Desregistrado do Eureka.")
    except Exception as ex:  # noqa: BLE001
        log.warning("Falha ao desregistrar do Eureka: %s", ex)
