package com.tes2.agent.memory.dto;

import java.util.List;

/** Corpo do POST /conversations/{id}/messages do memory-service. */
public record AppendRequest(List<MemoryMessage> messages) {
}
