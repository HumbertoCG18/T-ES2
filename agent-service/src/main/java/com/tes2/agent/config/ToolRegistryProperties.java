package com.tes2.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Acesso ao tool-registry (ferramentas remotas). lb://tool-registry (discovery) por padrão,
 * ou http://host:porta. Externalizado p/ Docker/K8s.
 */
@ConfigurationProperties(prefix = "tools")
public record ToolRegistryProperties(String baseUrl) {

    public ToolRegistryProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "lb://tool-registry";
        }
    }
}
