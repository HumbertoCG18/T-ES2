package com.tes2.memory.telemetry;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TelemetryEventRepository extends JpaRepository<TelemetryEvent, Long> {

    /** Eventos mais recentes (para inspeção / avaliação de desempenho). */
    List<TelemetryEvent> findTop50ByOrderByIdDesc();
}
