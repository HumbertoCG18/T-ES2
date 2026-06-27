package com.tes2.agent.llm.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChatCompletionRequest(
        String model,
        List<ChatMessage> messages,
        List<ToolSpec> tools
) {
}
