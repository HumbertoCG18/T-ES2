package com.tes2.memory.web.dto;

/** Resposta do POST de anexar: quantas mensagens foram persistidas. */
public record AppendResponse(int saved) {
}
