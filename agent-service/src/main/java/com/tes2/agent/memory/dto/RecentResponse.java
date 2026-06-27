package com.tes2.agent.memory.dto;

import java.util.List;

/** Resposta de GET /conversations/{id}/messages — mensagens em ordem antiga → nova. */
public record RecentResponse(String conversationId, List<MemoryMessage> messages) {
}
