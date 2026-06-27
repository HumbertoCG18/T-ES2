package com.tes2.agent.memory;

import com.tes2.agent.llm.dto.ChatMessage;
import com.tes2.agent.memory.dto.AppendRequest;
import com.tes2.agent.memory.dto.MemoryMessage;
import com.tes2.agent.memory.dto.RecentResponse;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Cliente do memory-service (lb://memory-service por padrão). Protegido por circuit breaker
 * 'memoryService' com time limiter curto: se a memória estiver fora, o fallback degrada
 * graciosamente (histórico vazio / persistência pulada) e o /chat nunca quebra por causa disso.
 */
@Component
public class MemoryClient {

    private static final Logger log = LoggerFactory.getLogger(MemoryClient.class);
    private static final String CB_NAME = "memoryService";

    private final RestClient client;
    private final CircuitBreakerFactory<?, ?> circuitBreakerFactory;

    public MemoryClient(RestClient memoryRestClient, CircuitBreakerFactory<?, ?> circuitBreakerFactory) {
        this.client = memoryRestClient;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    /** Histórico recente como ChatMessage (ordem antiga → nova). Fallback: lista vazia. */
    public List<ChatMessage> recentHistory(String conversationId, int limit) {
        return circuitBreakerFactory.create(CB_NAME).run(
                () -> fetchRecent(conversationId, limit),
                t -> {
                    log.warn("Falha ao carregar histórico (cid={}): {}", conversationId, t.toString());
                    return List.of();
                });
    }

    private List<ChatMessage> fetchRecent(String conversationId, int limit) {
        RecentResponse resp = client.get()
                .uri("/conversations/{id}/messages?limit={limit}", conversationId, limit)
                .retrieve()
                .body(RecentResponse.class);
        if (resp == null || resp.messages() == null) {
            return List.of();
        }
        return resp.messages().stream()
                .map(m -> new ChatMessage(m.role(), m.content(), null, m.toolCallId(), m.name()))
                .toList();
    }

    /** Persiste o turno (user + assistant final). Fallback: pula silenciosamente. */
    public void appendTurn(String conversationId, String userMessage, String assistantReply) {
        circuitBreakerFactory.create(CB_NAME).run(
                () -> {
                    AppendRequest body = new AppendRequest(List.of(
                            MemoryMessage.of("user", userMessage),
                            MemoryMessage.of("assistant", assistantReply)));
                    client.post()
                            .uri("/conversations/{id}/messages", conversationId)
                            .body(body)
                            .retrieve()
                            .toBodilessEntity();
                    return null;
                },
                t -> {
                    log.warn("Falha ao persistir turno (cid={}): {}", conversationId, t.toString());
                    return null;
                });
    }
}
