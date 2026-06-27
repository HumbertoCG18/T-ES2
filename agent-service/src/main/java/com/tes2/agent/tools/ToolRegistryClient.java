package com.tes2.agent.tools;

import com.tes2.agent.llm.dto.ToolSpec;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Cliente do tool-registry (lb://tool-registry). Busca as specs das ferramentas e delega a
 * execução. Protegido por circuit breaker 'toolRegistry' com time limiter curto: se o registry
 * estiver fora, o fallback degrada (sem ferramentas / observação de indisponibilidade) e o /chat
 * nunca quebra por causa disso.
 */
@Component
public class ToolRegistryClient {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistryClient.class);
    private static final String CB_NAME = "toolRegistry";

    private final RestClient client;
    private final CircuitBreakerFactory<?, ?> circuitBreakerFactory;

    public ToolRegistryClient(RestClient toolRestClient, CircuitBreakerFactory<?, ?> circuitBreakerFactory) {
        this.client = toolRestClient;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    /** Specs das ferramentas (formato OpenAI). Fallback: lista vazia (agente responde sem ferramentas). */
    public List<ToolSpec> specs() {
        return circuitBreakerFactory.create(CB_NAME).run(
                () -> {
                    ToolSpec[] specs = client.get().uri("/tools").retrieve().body(ToolSpec[].class);
                    return specs == null ? List.<ToolSpec>of() : List.of(specs);
                },
                t -> {
                    log.warn("tool-registry indisponível ao buscar specs: {}", t.toString());
                    return List.of();
                });
    }

    /** Executa uma ferramenta remota. Fallback: observação de indisponibilidade (o ciclo segue). */
    public String execute(String name, String argumentsJson) {
        return circuitBreakerFactory.create(CB_NAME).run(
                () -> {
                    ExecuteResponse resp = client.post()
                            .uri("/tools/{name}/execute", name)
                            .body(new ExecuteRequest(argumentsJson))
                            .retrieve()
                            .body(ExecuteResponse.class);
                    return resp == null ? "Ferramenta sem resposta." : resp.result();
                },
                t -> {
                    log.warn("tool-registry indisponível ao executar {}: {}", name, t.toString());
                    return "Ferramenta temporariamente indisponível.";
                });
    }

    private record ExecuteRequest(String arguments) {
    }

    private record ExecuteResponse(String result) {
    }
}
