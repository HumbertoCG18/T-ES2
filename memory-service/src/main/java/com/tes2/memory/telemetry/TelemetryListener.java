package com.tes2.memory.telemetry;

import com.tes2.memory.config.RabbitConfig;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/** Consome telemetry.events e persiste no Postgres. */
@Component
public class TelemetryListener {

    private static final Logger log = LoggerFactory.getLogger(TelemetryListener.class);

    private final TelemetryEventRepository repository;

    public TelemetryListener(TelemetryEventRepository repository) {
        this.repository = repository;
    }

    @RabbitListener(queues = RabbitConfig.TELEMETRY_QUEUE)
    public void onEvent(TelemetryEventDto dto) {
        try {
            List<String> tools = dto.toolsUsed() == null ? List.of() : dto.toolsUsed();
            repository.save(new TelemetryEvent(
                    dto.conversationId(),
                    dto.latencyMs(),
                    dto.iterations(),
                    dto.ragHits(),
                    String.join(",", tools),
                    dto.model(),
                    dto.timestamp()));
            log.info("Telemetria persistida: cid={} latency={}ms iter={} ragHits={} tools={}",
                    dto.conversationId(), dto.latencyMs(), dto.iterations(), dto.ragHits(), tools);
        } catch (Exception ex) {
            // Telemetria é best-effort: falha de persistência não deve gerar requeue infinito
            // (mensagem malformada ou BD fora do ar). Loga e descarta.
            log.warn("Falha ao persistir telemetria (descartada) cid={}: {}",
                    dto == null ? null : dto.conversationId(), ex.toString());
        }
    }
}
