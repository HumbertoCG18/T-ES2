package com.tes2.agent.llm;

import com.tes2.agent.config.LlmProperties;
import com.tes2.agent.llm.dto.ChatCompletionRequest;
import com.tes2.agent.llm.dto.ChatCompletionResponse;
import com.tes2.agent.llm.dto.ChatMessage;
import com.tes2.agent.llm.dto.ToolSpec;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Cliente sincrono para o llm-gateway (endpoint OpenAI-compativel /v1/chat/completions).
 * A chamada e protegida por um circuit breaker (Resilience4j via Spring Cloud CircuitBreaker):
 * quando o gateway esta indisponivel, o breaker abre e devolve um fallback semantico em vez de
 * propagar a falha — atende ao requisito de resiliencia da plataforma.
 */
@Component
public class LlmClient {

    private static final String CB_NAME = "llmGateway";

    private final RestClient client;
    private final LlmProperties props;
    private final CircuitBreakerFactory<?, ?> circuitBreakerFactory;

    public LlmClient(RestClient llmRestClient, LlmProperties props,
                     CircuitBreakerFactory<?, ?> circuitBreakerFactory) {
        this.client = llmRestClient;
        this.props = props;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    public ChatMessage complete(List<ChatMessage> messages, List<ToolSpec> tools, String model) {
        return circuitBreakerFactory.create(CB_NAME).run(
                () -> doComplete(messages, tools, model),
                this::completeFallback);
    }

    private ChatMessage doComplete(List<ChatMessage> messages, List<ToolSpec> tools, String model) {
        String effectiveModel = (model == null || model.isBlank()) ? props.model() : model;
        ChatCompletionRequest request =
                new ChatCompletionRequest(effectiveModel, messages, tools, props.temperature());
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

    private ChatMessage completeFallback(Throwable t) {
        // Sem tool_calls: o AgentLoop trata como resposta final e encerra o ciclo.
        return new ChatMessage(
                "assistant",
                "O servico de IA esta temporariamente indisponivel. Tente novamente em instantes.",
                null,
                null,
                null);
    }
}
