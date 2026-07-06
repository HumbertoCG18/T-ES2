package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

/** Sorteio: escolhe um item de uma lista, ou um inteiro aleatório em [min, max]. */
@Component
public class RandomTool implements Tool {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String name() {
        return "random";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "choices", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string"),
                                "description", "Opções para sortear uma (tem prioridade sobre min/max)"),
                        "min", Map.of("type", "integer", "description", "Mínimo (padrão 1)"),
                        "max", Map.of("type", "integer", "description", "Máximo (padrão 100)")),
                "required", List.of());
        return ToolSpec.function(name(),
                "Sorteia um item de uma lista de opções, ou um inteiro aleatório entre min e max.",
                parameters);
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            JsonNode node = mapper.readTree(argumentsJson);
            JsonNode choices = node.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                List<String> opts = new ArrayList<>();
                choices.forEach(c -> opts.add(c.asText()));
                return opts.get(ThreadLocalRandom.current().nextInt(opts.size()));
            }
            int min = node.path("min").asInt(1);
            int max = node.path("max").asInt(100);
            if (min > max) {
                int t = min;
                min = max;
                max = t;
            }
            return String.valueOf(ThreadLocalRandom.current().nextInt(min, max + 1));
        } catch (Exception e) {
            return "Erro ao sortear: " + e.getMessage();
        }
    }
}
