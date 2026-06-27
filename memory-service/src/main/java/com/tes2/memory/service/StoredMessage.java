package com.tes2.memory.service;

/** Forma serializada (JSON) de uma mensagem na List do Redis (sessão quente). */
public record StoredMessage(String role, String content, String toolCallId, String name) {
}
