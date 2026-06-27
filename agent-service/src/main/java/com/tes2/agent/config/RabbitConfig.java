package com.tes2.agent.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Mensageria (Entrega 4). O agent-service é PRODUTOR em dois fluxos:
 *  - document.ingest  → consumido pelo retrieval-service (Python/aio-pika), ingestão assíncrona.
 *  - telemetry.events → consumido pelo memory-service (@RabbitListener), telemetria por /chat.
 *
 * Topologia simples para interop Spring↔Python: default exchange + filas duráveis nomeadas
 * (routing key = nome da fila). Mensagens em JSON via Jackson2JsonMessageConverter — o
 * RabbitTemplate auto-configurado adota o bean MessageConverter automaticamente.
 */
@Configuration
public class RabbitConfig {

    public static final String DOCUMENT_INGEST_QUEUE = "document.ingest";
    public static final String TELEMETRY_QUEUE = "telemetry.events";

    @Bean
    Queue documentIngestQueue() {
        return new Queue(DOCUMENT_INGEST_QUEUE, true); // durable
    }

    @Bean
    Queue telemetryQueue() {
        return new Queue(TELEMETRY_QUEUE, true); // durable
    }

    /**
     * Usa o ObjectMapper do Boot (com JavaTimeModule) para serializar Instant da telemetria
     * como ISO-8601. O default new Jackson2JsonMessageConverter() usaria um ObjectMapper cru,
     * que falha em java.time.*.
     */
    @Bean
    MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}
