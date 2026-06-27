package com.tes2.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Acesso ao retrieval-service (RAG). `retrieval.base-url` aceita lb://retrieval-service
 * (discovery via Eureka) OU http://host:porta (fallback URL fixa; precedente do llm-gateway,
 * ver R1/ADR 0008). Trocar é só de configuração.
 *
 * @param baseUrl lb://retrieval-service (padrão) ou http://host:porta
 * @param topK    nº de trechos recuperados por busca (ver R3)
 */
@ConfigurationProperties(prefix = "retrieval")
public record RetrievalProperties(String baseUrl, int topK) {

    public RetrievalProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "lb://retrieval-service";
        }
        if (topK <= 0) {
            topK = 4;
        }
    }
}
