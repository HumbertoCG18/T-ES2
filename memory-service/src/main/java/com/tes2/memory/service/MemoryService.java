package com.tes2.memory.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tes2.memory.config.MemoryProperties;
import com.tes2.memory.domain.ConversationMessage;
import com.tes2.memory.repo.ConversationMessageRepository;
import com.tes2.memory.web.dto.MessageDto;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Memória de conversação com dois níveis (ver "Decisões de design" do plano da Entrega 3):
 *
 *  - PostgreSQL = fonte da verdade (longo prazo): todo turno persistido de forma durável.
 *  - Redis      = cache da sessão ativa (curto prazo): últimas N mensagens numa List, com TTL.
 *
 * Escrita = write-through (grava nos dois). Leitura = Redis-first; em miss, carrega do Postgres
 * e reaquece o Redis. O Redis é só cache: falha nele nunca derruba a operação (Postgres mandou).
 *
 * Convenção da List Redis: LPUSH coloca o mais novo na cabeça (índice 0). Logo
 * `LRANGE key 0 N-1` devolve novo→antigo; invertemos para entregar antigo→novo.
 */
@Service
public class MemoryService {

    private static final Logger log = LoggerFactory.getLogger(MemoryService.class);

    private final ConversationMessageRepository repo;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final MemoryProperties props;

    public MemoryService(ConversationMessageRepository repo, StringRedisTemplate redis,
                         ObjectMapper mapper, MemoryProperties props) {
        this.repo = repo;
        this.redis = redis;
        this.mapper = mapper;
        this.props = props;
    }

    private static String key(String conversationId) {
        return "conv:" + conversationId + ":messages";
    }

    /** Anexa mensagens: persiste no Postgres e atualiza a List do Redis (write-through). */
    @Transactional
    public int append(String conversationId, List<MessageDto> messages) {
        int saved = 0;
        for (MessageDto m : messages) {
            repo.save(ConversationMessage.of(conversationId, m.role(), m.content(), m.toolCallId(), m.name()));
            pushRedis(conversationId, new StoredMessage(m.role(), m.content(), m.toolCallId(), m.name()));
            saved++;
        }
        return saved;
    }

    private void pushRedis(String conversationId, StoredMessage sm) {
        String k = key(conversationId);
        try {
            redis.opsForList().leftPush(k, mapper.writeValueAsString(sm));
            redis.opsForList().trim(k, 0, props.historyLimit() - 1L);
            redis.expire(k, Duration.ofSeconds(props.redisTtlSeconds()));
        } catch (Exception ex) {
            // Postgres já persistiu; Redis é cache → degradar silenciosamente.
            log.warn("Falha ao escrever no Redis (cid={}): {}", conversationId, ex.toString());
        }
    }

    /** Histórico recente em ordem antiga→nova: tenta Redis; em miss, Postgres + reaquece o Redis. */
    public List<MessageDto> recent(String conversationId, int limit) {
        int n = limit > 0 ? limit : props.historyLimit();

        try {
            List<String> raw = redis.opsForList().range(key(conversationId), 0, n - 1L);
            if (raw != null && !raw.isEmpty()) {
                List<MessageDto> out = new ArrayList<>(raw.size());
                for (String s : raw) {
                    out.add(toDto(mapper.readValue(s, StoredMessage.class)));
                }
                Collections.reverse(out); // novo→antigo  =>  antigo→novo
                return out;
            }
        } catch (Exception ex) {
            log.warn("Leitura Redis falhou (cid={}), caindo p/ Postgres: {}", conversationId, ex.toString());
        }

        List<ConversationMessage> rows =
                repo.findByConversationIdOrderByIdDesc(conversationId, PageRequest.of(0, n));
        Collections.reverse(rows); // novo→antigo  =>  antigo→novo
        reheat(conversationId, rows);
        return rows.stream().map(this::toDto).toList();
    }

    /** Reconstrói a List do Redis a partir de linhas em ordem antiga→nova (mais nova vira a cabeça). */
    private void reheat(String conversationId, List<ConversationMessage> ascRows) {
        if (ascRows.isEmpty()) {
            return;
        }
        String k = key(conversationId);
        try {
            redis.delete(k);
            for (ConversationMessage e : ascRows) {
                redis.opsForList().leftPush(k, mapper.writeValueAsString(
                        new StoredMessage(e.getRole(), e.getContent(), e.getToolCallId(), e.getName())));
            }
            redis.opsForList().trim(k, 0, props.historyLimit() - 1L);
            redis.expire(k, Duration.ofSeconds(props.redisTtlSeconds()));
        } catch (Exception ex) {
            log.warn("Reheat do Redis falhou (cid={}): {}", conversationId, ex.toString());
        }
    }

    /** Histórico completo (sempre Postgres), ordem antiga→nova. */
    public List<MessageDto> history(String conversationId) {
        return repo.findByConversationIdOrderByIdAsc(conversationId).stream().map(this::toDto).toList();
    }

    /** Limpa os dois níveis (Postgres + Redis). */
    @Transactional
    public void clear(String conversationId) {
        repo.deleteByConversationId(conversationId);
        try {
            redis.delete(key(conversationId));
        } catch (Exception ex) {
            log.warn("Delete da key Redis falhou (cid={}): {}", conversationId, ex.toString());
        }
    }

    private MessageDto toDto(StoredMessage s) {
        return new MessageDto(s.role(), s.content(), s.toolCallId(), s.name());
    }

    private MessageDto toDto(ConversationMessage e) {
        return new MessageDto(e.getRole(), e.getContent(), e.getToolCallId(), e.getName());
    }
}
