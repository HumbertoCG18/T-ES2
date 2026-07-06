package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Conta caracteres, palavras e linhas de um texto. */
@Component
public class TextStatsTool implements Tool {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String name() {
        return "text_stats";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "text", Map.of("type", "string", "description", "Texto a analisar")),
                "required", List.of("text"));
        return ToolSpec.function(name(),
                "Conta caracteres, palavras e linhas de um texto.", parameters);
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            JsonNode node = mapper.readTree(argumentsJson);
            String text = node.path("text").asText("");
            int chars = text.length();
            int words = text.isBlank() ? 0 : text.trim().split("\\s+").length;
            int lines = text.isEmpty() ? 0 : text.split("\n", -1).length;
            return "caracteres=" + chars + " palavras=" + words + " linhas=" + lines;
        } catch (Exception e) {
            return "Erro ao analisar texto: " + e.getMessage();
        }
    }
}
