package com.tes2.agent.llm.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Mensagem no formato OpenAI Chat Completions (compativel com o que o LiteLLM expoe).
 * Campos nulos sao omitidos na serializacao.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChatMessage(
        String role,
        String content,
        @JsonProperty("tool_calls") List<ToolCall> toolCalls,
        @JsonProperty("tool_call_id") String toolCallId,
        String name
) {

    public static ChatMessage system(String content) {
        return new ChatMessage("system", content, null, null, null);
    }

    public static ChatMessage user(String content) {
        return new ChatMessage("user", content, null, null, null);
    }

    public static ChatMessage tool(String toolCallId, String name, String content) {
        return new ChatMessage("tool", content, null, toolCallId, name);
    }
}
