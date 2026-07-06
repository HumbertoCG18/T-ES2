package com.tes2.agent.llm.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChatCompletionRequest(
        String model,
        List<ChatMessage> messages,
        List<ToolSpec> tools,
        Double temperature,
        @JsonProperty("max_tokens") Integer maxTokens
) {
}
