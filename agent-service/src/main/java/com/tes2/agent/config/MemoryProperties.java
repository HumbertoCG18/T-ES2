package com.tes2.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Acesso ao memory-service (histórico de conversação). Resolvido por discovery (lb://) ou
 * por URL fixa, conforme `memory.base-url`. Externalizado p/ Docker/K8s.
 *
 * @param baseUrl      lb://memory-service (padrão) ou http://host:porta
 * @param historyLimit N de mensagens recentes carregadas como contexto do LLM (ver R3)
 */
@ConfigurationProperties(prefix = "memory")
public record MemoryProperties(String baseUrl, int historyLimit) {

    public MemoryProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "lb://memory-service";
        }
        if (historyLimit <= 0) {
            historyLimit = 20;
        }
    }
}
