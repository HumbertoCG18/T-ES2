package com.tes2.memory.web.dto;

import java.util.List;

/** Resposta de leitura (recent/history): mensagens em ordem antiga → nova. */
public record HistoryResponse(String conversationId, List<MessageDto> messages) {
}
