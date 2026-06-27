package com.tes2.agent.telemetry;

import com.tes2.agent.config.RabbitConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * Publica telemetria na fila telemetry.events. Best-effort (fire-and-forget): falha ao publicar
 * é logada e ignorada — o /chat nunca quebra por causa de telemetria.
 */
@Component
public class TelemetryProducer {

    private static final Logger log = LoggerFactory.getLogger(TelemetryProducer.class);

    private final RabbitTemplate rabbitTemplate;

    public TelemetryProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publish(TelemetryEventDto event) {
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.TELEMETRY_QUEUE, event);
        } catch (Exception ex) {
            log.warn("Telemetria não publicada (cid={}): {}", event.conversationId(), ex.toString());
        }
    }
}
