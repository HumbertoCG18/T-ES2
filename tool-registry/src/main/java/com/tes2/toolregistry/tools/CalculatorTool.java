package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Avalia expressoes aritmeticas. */
@Component
public class CalculatorTool implements Tool {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String name() {
        return "calculator";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "expression", Map.of(
                                "type", "string",
                                "description", "Expressao aritmetica a avaliar, ex: (2 + 3) * 4"
                        )
                ),
                "required", List.of("expression")
        );
        return ToolSpec.function(
                name(),
                "Avalia uma expressao aritmetica com +, -, *, / e parenteses.",
                parameters
        );
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            JsonNode node = mapper.readTree(argumentsJson);
            String expression = node.path("expression").asText();
            double result = new ExpressionParser(expression).parse();
            return formatResult(result);
        } catch (Exception e) {
            return "Erro ao avaliar expressao: " + e.getMessage();
        }
    }

    private String formatResult(double result) {
        if (result == Math.floor(result) && !Double.isInfinite(result)) {
            return String.valueOf((long) result);
        }
        return String.valueOf(result);
    }
}
