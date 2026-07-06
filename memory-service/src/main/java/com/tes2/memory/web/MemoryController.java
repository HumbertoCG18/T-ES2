package com.tes2.memory.web;

import com.tes2.memory.service.MemoryService;
import com.tes2.memory.web.dto.AppendRequest;
import com.tes2.memory.web.dto.AppendResponse;
import com.tes2.memory.web.dto.HistoryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API de memória por conversationId. Serviço interno: chamado pelo agent-service
 * (lb://memory-service); não exposto pelo api-gateway nesta entrega.
 */
@RestController
@RequestMapping("/conversations/{conversationId}")
public class MemoryController {

    private final MemoryService memory;

    public MemoryController(MemoryService memory) {
        this.memory = memory;
    }

    /** Anexa 1+ mensagens (write-through Redis + Postgres). */
    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public AppendResponse append(@PathVariable String conversationId, @Valid @RequestBody AppendRequest req) {
        return new AppendResponse(memory.append(conversationId, req.messages()));
    }

    /** Histórico recente (Redis-first → Postgres), ordem antiga → nova. */
    @GetMapping("/messages")
    public HistoryResponse recent(@PathVariable String conversationId,
                                  @RequestParam(defaultValue = "20") int limit) {
        return new HistoryResponse(conversationId, memory.recent(conversationId, limit));
    }

    /** Histórico completo (sempre Postgres) — prova do nível durável. */
    @GetMapping("/history")
    public HistoryResponse history(@PathVariable String conversationId) {
        return new HistoryResponse(conversationId, memory.history(conversationId));
    }

    /** Limpa Redis + Postgres da conversa. */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@PathVariable String conversationId) {
        memory.clear(conversationId);
    }
}
