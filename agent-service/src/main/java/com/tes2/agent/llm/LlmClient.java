package com.tes2.agent.llm;

import com.tes2.agent.config.LlmProperties;
import com.tes2.agent.llm.dto.ChatCompletionRequest;
import com.tes2.agent.llm.dto.ChatCompletionResponse;
import com.tes2.agent.llm.dto.ChatMessage;
import com.tes2.agent.llm.dto.ToolSpec;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/** Cliente sincrono para o llm-gateway (endpoint OpenAI-compativel /v1/chat/completions). */
@Component
public class LlmClient {

    private final RestClient client;
    private final LlmProperties props;

    public LlmClient(RestClient llmRestClient, LlmProperties props) {
        this.client = llmRestClient;
        this.props = props;
    }

    public ChatMessage complete(List<ChatMessage> messages, List<ToolSpec> tools) {
        ChatCompletionRequest request = new ChatCompletionRequest(props.model(), messages, tools);
        ChatCompletionResponse response = client.post()
                .uri("/v1/chat/completions")
                .body(request)
                .retrieve()
                .body(ChatCompletionResponse.class);

        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            throw new IllegalStateException("Resposta vazia do llm-gateway");
        }
        return response.choices().get(0).message();
    }
}
