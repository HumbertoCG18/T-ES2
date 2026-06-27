package com.tes2.agent.telemetry;

import java.time.Instant;
import java.util.List;

/**
 * Evento de telemetria publicado ao fim de cada /chat (fila telemetry.events).
 * Consumido e persistido pelo memory-service para alimentar a avaliação de desempenho.
 */
public record TelemetryEventDto(
        String conversationId,
        long latencyMs,
        int iterations,
        List<String> toolsUsed,
        int ragHits,
        String model,
        Instant timestamp) {
}
