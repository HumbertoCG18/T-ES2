package com.tes2.agent.web;

import com.tes2.agent.agent.AgentLoop;
import com.tes2.agent.agent.AgentResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private final AgentLoop agentLoop;

    public ChatController(AgentLoop agentLoop) {
        this.agentLoop = agentLoop;
    }

    @PostMapping
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        AgentResult result = agentLoop.run(request.message());
        return new ChatResponse(result.reply(), result.trace());
    }

    public record ChatRequest(@NotBlank String message) {
    }

    public record ChatResponse(String reply, List<String> trace) {
    }
}
