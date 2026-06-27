package com.tes2.memory.telemetry;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Inspeção dos eventos de telemetria persistidos (apoio à avaliação de desempenho). */
@RestController
@RequestMapping("/telemetry")
public class TelemetryController {

    private final TelemetryEventRepository repository;

    public TelemetryController(TelemetryEventRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<TelemetryEvent> recent() {
        return repository.findTop50ByOrderByIdDesc();
    }
}
