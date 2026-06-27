package com.tes2.memory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Parâmetros da memória (externalizados; ver R3 do plano da Entrega 3).
 *
 * @param historyLimit     N de mensagens mantidas no Redis (LTRIM) e lidas como contexto recente
 * @param redisTtlSeconds  TTL da sessão quente no Redis
 */
@ConfigurationProperties(prefix = "memory")
public record MemoryProperties(int historyLimit, long redisTtlSeconds) {

    public MemoryProperties {
        if (historyLimit <= 0) {
            historyLimit = 20;
        }
        if (redisTtlSeconds <= 0) {
            redisTtlSeconds = 3600;
        }
    }
}
