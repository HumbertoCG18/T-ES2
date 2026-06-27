package com.tes2.memory.telemetry;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Evento de telemetria persistido (longo prazo) — insumo para a avaliação de desempenho
 * (latência, iterações, uso de ferramentas, hits de RAG) por conversa.
 */
@Entity
@Table(name = "telemetry_event")
public class TelemetryEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", length = 64)
    private String conversationId;

    @Column(name = "latency_ms")
    private long latencyMs;

    private int iterations;

    @Column(name = "rag_hits")
    private int ragHits;

    @Column(name = "tools_used", length = 256)
    private String toolsUsed; // ferramentas usadas, separadas por vírgula

    @Column(length = 64)
    private String model;

    @Column(name = "created_at")
    private Instant createdAt;

    protected TelemetryEvent() {
        // exigido pelo JPA
    }

    public TelemetryEvent(String conversationId, long latencyMs, int iterations, int ragHits,
                          String toolsUsed, String model, Instant createdAt) {
        this.conversationId = conversationId;
        this.latencyMs = latencyMs;
        this.iterations = iterations;
        this.ragHits = ragHits;
        this.toolsUsed = toolsUsed;
        this.model = model;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getConversationId() {
        return conversationId;
    }

    public long getLatencyMs() {
        return latencyMs;
    }

    public int getIterations() {
        return iterations;
    }

    public int getRagHits() {
        return ragHits;
    }

    public String getToolsUsed() {
        return toolsUsed;
    }

    public String getModel() {
        return model;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
