package com.tes2.memory.web.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Mensagem trocada com o serviço de memória.
 * `role` obrigatório; `content` pode ser nulo (ex.: turno só com tool-calls);
 * `toolCallId`/`name` opcionais (usados por mensagens tool, normalmente efêmeras).
 */
public record MessageDto(
        @NotBlank String role,
        String content,
        String toolCallId,
        String name
) {
}
