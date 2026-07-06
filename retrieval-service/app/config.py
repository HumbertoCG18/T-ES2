"""Configuração do retrieval-service (toda externalizada por env, p/ Docker/K8s).

Regra inegociável: embeddings sempre via llm-gateway local (nunca provedor de nuvem).
"""

import os


class Settings:
    # --- Embeddings (via llm-gateway / LiteLLM, OpenAI-compatível) ---
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:4000")
    embeddings_model: str = os.getenv("EMBEDDINGS_MODEL", "embeddings")  # nome lógico no llm-gateway
    embeddings_timeout: float = float(os.getenv("EMBEDDINGS_TIMEOUT", "120"))  # read timeout; embeddinggemma:300m é rápido

    # --- ChromaDB (container servidor, HttpClient) ---
    chroma_host: str = os.getenv("CHROMA_HOST", "localhost")
    chroma_port: int = int(os.getenv("CHROMA_PORT", "8000"))
    chroma_collection: str = os.getenv("CHROMA_COLLECTION", "knowledge")  # 1 coleção, 1 dimensão

    # --- Chunking / busca ---
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "800"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "100"))
    default_top_k: int = int(os.getenv("DEFAULT_TOP_K", "4"))

    # --- Mensageria (Entrega 4): consumer de ingestao assincrona ---
    rabbitmq_host: str = os.getenv("RABBITMQ_HOST", "localhost")
    rabbitmq_port: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    rabbitmq_user: str = os.getenv("RABBITMQ_USERNAME", "guest")
    rabbitmq_password: str = os.getenv("RABBITMQ_PASSWORD", "guest")
    ingest_queue: str = os.getenv("INGEST_QUEUE", "document.ingest")
    messaging_enabled: bool = os.getenv("MESSAGING_ENABLED", "true").lower() == "true"
    # Intervalo entre tentativas de (re)conexão ao broker (boot race + quedas em produção).
    rabbitmq_reconnect_seconds: int = int(os.getenv("RABBITMQ_RECONNECT_SECONDS", "5"))

    # --- Identidade / discovery ---
    service_name: str = os.getenv("SERVICE_NAME", "retrieval-service")
    service_port: int = int(os.getenv("SERVICE_PORT", "8083"))
    service_host: str = os.getenv("SERVICE_HOST", "localhost")
    service_ip: str = os.getenv("SERVICE_IP", "127.0.0.1")  # registrado no Eureka (como prefer-ip)
    eureka_url: str = os.getenv("EUREKA_URL", "http://localhost:8761/eureka")
    # Permite desligar o registro no Eureka (fallback URL fixa; ver R1/ADR 0008).
    eureka_enabled: bool = os.getenv("EUREKA_ENABLED", "true").lower() == "true"


settings = Settings()
