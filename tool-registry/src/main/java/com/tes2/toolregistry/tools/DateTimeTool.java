package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Devolve a data/hora atual. Util para o agente responder "que dia e hoje", calcular prazos, etc. */
@Component
public class DateTimeTool implements Tool {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String name() {
        return "datetime";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "timezone", Map.of(
                                "type", "string",
                                "description", "Fuso horario IANA opcional, ex: America/Sao_Paulo (padrao do sistema se ausente)"
                        )
                ),
                "required", java.util.List.of()
        );
        return ToolSpec.function(
                name(),
                "Retorna a data e hora atuais (ISO-8601) no fuso informado ou no fuso do sistema.",
                parameters
        );
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            ZoneId zone = ZoneId.systemDefault();
            if (argumentsJson != null && !argumentsJson.isBlank()) {
                JsonNode node = mapper.readTree(argumentsJson);
                String tz = node.path("timezone").asText("");
                if (!tz.isBlank()) {
                    zone = ZoneId.of(tz);
                }
            }
            ZonedDateTime now = ZonedDateTime.now(zone);
            return now.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) + " (" + zone + ")";
        } catch (Exception e) {
            return "Erro ao obter data/hora: " + e.getMessage();
        }
    }
}
