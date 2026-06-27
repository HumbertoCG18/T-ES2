package com.tes2.agent.ingestion;

import com.tes2.agent.config.RabbitConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/** Publica documentos na fila document.ingest (default exchange, routing key = nome da fila). */
@Component
public class IngestionProducer {

    private final RabbitTemplate rabbitTemplate;

    public IngestionProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    /** Lança AmqpException se o broker estiver indisponível (o controller mapeia para 503). */
    public void publish(IngestionMessage message) {
        rabbitTemplate.convertAndSend(RabbitConfig.DOCUMENT_INGEST_QUEUE, message);
    }
}
