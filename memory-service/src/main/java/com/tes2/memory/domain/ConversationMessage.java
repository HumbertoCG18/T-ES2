package com.tes2.memory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Turno persistido no longo prazo (PostgreSQL = fonte da verdade).
 * Guarda-se apenas o turno conversacional limpo (user + assistant final);
 * mensagens 'tool' intermediarias do ciclo agentico ficam efemeras (ver R5 do plano).
 */
@Entity
@Table(
        name = "conversation_message",
        indexes = @Index(name = "idx_msg_conversation", columnList = "conversation_id,id")
)
public class ConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // BIGSERIAL no Postgres
    private Long id;

    @Column(name = "conversation_id", nullable = false, length = 64)
    private String conversationId;

    @Column(nullable = false, length = 20)
    private String role; // user | assistant | system | tool

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "tool_call_id", length = 64)
    private String toolCallId;

    @Column(length = 64)
    private String name;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ConversationMessage() {
        // exigido pelo JPA
    }

    private ConversationMessage(String conversationId, String role, String content,
                                String toolCallId, String name) {
        this.conversationId = conversationId;
        this.role = role;
        this.content = content;
        this.toolCallId = toolCallId;
        this.name = name;
    }

    public static ConversationMessage of(String conversationId, String role, String content,
                                         String toolCallId, String name) {
        return new ConversationMessage(conversationId, role, content, toolCallId, name);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getConversationId() {
        return conversationId;
    }

    public String getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public String getToolCallId() {
        return toolCallId;
    }

    public String getName() {
        return name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
