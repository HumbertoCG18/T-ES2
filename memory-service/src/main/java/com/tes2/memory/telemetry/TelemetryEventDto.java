package com.tes2.memory.telemetry;

import java.time.Instant;
import java.util.List;

/**
 * Forma da mensagem recebida da fila telemetry.events (espelha o DTO do agent-service).
 * Desserializada por inferência de tipo (ver RabbitConfig).
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
