package com.tes2.toolregistry.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Acesso ao retrieval-service para a ferramenta knowledge_search. lb:// ou http://host:porta. */
@ConfigurationProperties(prefix = "retrieval")
public record RetrievalProperties(String baseUrl) {

    public RetrievalProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "lb://retrieval-service";
        }
    }
}
