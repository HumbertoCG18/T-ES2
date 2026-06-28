package com.tes2.agent.web;

import com.tes2.agent.memory.MemoryClient;
import com.tes2.agent.memory.dto.MemoryMessage;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Visualização/gestão da memória de uma conversa, para a UI ("ver/gerenciar memória").
 * Proxy para o memory-service (que é interno) através do agent-service, exposto pelo gateway.
 */
@RestController
@RequestMapping("/memory")
public class MemoryViewController {

    private final MemoryClient memoryClient;

    public MemoryViewController(MemoryClient memoryClient) {
        this.memoryClient = memoryClient;
    }

    @GetMapping("/{conversationId}")
    public List<MemoryMessage> history(@PathVariable String conversationId) {
        return memoryClient.history(conversationId);
    }

    @DeleteMapping("/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@PathVariable String conversationId) {
        memoryClient.clear(conversationId);
    }
}
