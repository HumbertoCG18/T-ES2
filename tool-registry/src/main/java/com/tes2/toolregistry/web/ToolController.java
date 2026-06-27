package com.tes2.toolregistry.web;

import com.tes2.toolregistry.tools.ToolRegistry;
import com.tes2.toolregistry.tools.ToolSpec;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * API do tool-registry. Serviço interno (chamado pelo agent-service via lb://tool-registry);
 * exposto pelo api-gateway apenas para inspeção (GET /tools).
 */
@RestController
@RequestMapping("/tools")
public class ToolController {

    private final ToolRegistry registry;

    public ToolController(ToolRegistry registry) {
        this.registry = registry;
    }

    /** Specs no formato OpenAI, prontas para o agent-service repassar ao LLM. */
    @GetMapping
    public List<ToolSpec> tools() {
        return registry.specs();
    }

    /** Executa uma ferramenta. O resultado (inclusive erros de execução) vem em `result`. */
    @PostMapping("/{name}/execute")
    public ExecuteResponse execute(@PathVariable String name, @RequestBody ExecuteRequest request) {
        if (!registry.has(name)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ferramenta desconhecida: " + name);
        }
        String args = request == null || request.arguments() == null ? "{}" : request.arguments();
        return new ExecuteResponse(registry.execute(name, args));
    }

    /** `arguments` = string JSON produzida pelo LLM, ex.: {"expression":"(2+3)*4"}. */
    public record ExecuteRequest(String arguments) {
    }

    public record ExecuteResponse(String result) {
    }
}
