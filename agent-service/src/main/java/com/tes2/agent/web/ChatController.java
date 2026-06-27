package com.tes2.agent.web;

import com.tes2.agent.agent.AgentLoop;
import com.tes2.agent.agent.AgentResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private final AgentLoop agentLoop;

    public ChatController(AgentLoop agentLoop) {
        this.agentLoop = agentLoop;
    }

    @PostMapping
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        // Back-compat: sem conversationId, gera um (stateless) e devolve ao cliente.
        String conversationId = (request.conversationId() == null || request.conversationId().isBlank())
                ? UUID.randomUUID().toString()
                : request.conversationId();
        AgentResult result = agentLoop.run(conversationId, request.message());
        return new ChatResponse(conversationId, result.reply(), result.trace());
    }

    public record ChatRequest(@NotBlank String message, String conversationId) {
    }

    public record ChatResponse(String conversationId, String reply, List<String> trace) {
    }
}
