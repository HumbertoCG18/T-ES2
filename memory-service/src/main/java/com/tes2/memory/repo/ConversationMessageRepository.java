package com.tes2.memory.repo;

import com.tes2.memory.domain.ConversationMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    /** Histórico completo, ordem antiga → nova (prova do nível durável). */
    List<ConversationMessage> findByConversationIdOrderByIdAsc(String conversationId);

    /** Últimas N mensagens (ordem nova → antiga); usar Pageable para o limite. */
    List<ConversationMessage> findByConversationIdOrderByIdDesc(String conversationId, Pageable pageable);

    /** Apaga o histórico durável da conversa; chamado dentro de transação no serviço. */
    long deleteByConversationId(String conversationId);
}
