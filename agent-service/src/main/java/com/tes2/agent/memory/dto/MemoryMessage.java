package com.tes2.agent.memory.dto;

/**
 * Mensagem trocada com o memory-service (espelha o MessageDto do serviço: role, content,
 * toolCallId, name em camelCase).
 */
public record MemoryMessage(String role, String content, String toolCallId, String name) {

    public static MemoryMessage of(String role, String content) {
        return new MemoryMessage(role, content, null, null);
    }
}
