package com.tes2.memory.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/** Corpo do POST /conversations/{id}/messages — 1+ mensagens a anexar (write-through). */
public record AppendRequest(
        @NotEmpty @Valid List<MessageDto> messages
) {
}
