package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Conversão de unidades: comprimento (m base), massa (g base) e temperatura (C/F/K).
 * Fatores fixos, sem dependência externa.
 */
@Component
public class UnitConvertTool implements Tool {

    // Para a base (metros / gramas).
    private static final Map<String, Double> LENGTH = Map.of(
            "km", 1000.0, "m", 1.0, "cm", 0.01, "mm", 0.001,
            "mi", 1609.344, "yd", 0.9144, "ft", 0.3048, "in", 0.0254);
    private static final Map<String, Double> MASS = Map.of(
            "t", 1_000_000.0, "kg", 1000.0, "g", 1.0, "mg", 0.001,
            "lb", 453.59237, "oz", 28.349523);

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String name() {
        return "unit_convert";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "value", Map.of("type", "number", "description", "Valor a converter"),
                        "from", Map.of("type", "string", "description", "Unidade de origem (km,m,cm,mm,mi,yd,ft,in,t,kg,g,mg,lb,oz,C,F,K)"),
                        "to", Map.of("type", "string", "description", "Unidade de destino (mesma dimensão da origem)")),
                "required", List.of("value", "from", "to"));
        return ToolSpec.function(name(),
                "Converte um valor entre unidades de comprimento, massa ou temperatura.", parameters);
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            JsonNode node = mapper.readTree(argumentsJson);
            double value = node.path("value").asDouble();
            String from = node.path("from").asText("").trim();
            String to = node.path("to").asText("").trim();

            String fu = from.toLowerCase(Locale.ROOT);
            String tu = to.toLowerCase(Locale.ROOT);

            if (isTemp(from) && isTemp(to)) {
                return format(convertTemp(value, from.toUpperCase(Locale.ROOT), to.toUpperCase(Locale.ROOT))) + " " + to.toUpperCase(Locale.ROOT);
            }
            if (LENGTH.containsKey(fu) && LENGTH.containsKey(tu)) {
                return format(value * LENGTH.get(fu) / LENGTH.get(tu)) + " " + tu;
            }
            if (MASS.containsKey(fu) && MASS.containsKey(tu)) {
                return format(value * MASS.get(fu) / MASS.get(tu)) + " " + tu;
            }
            return "Conversão não suportada: " + from + " -> " + to
                    + " (unidades devem ser da mesma dimensão: comprimento, massa ou temperatura).";
        } catch (Exception e) {
            return "Erro na conversão: " + e.getMessage();
        }
    }

    private static boolean isTemp(String u) {
        String x = u.trim().toUpperCase(Locale.ROOT);
        return x.equals("C") || x.equals("F") || x.equals("K");
    }

    private static double convertTemp(double v, String from, String to) {
        double celsius = switch (from) {
            case "F" -> (v - 32) * 5 / 9;
            case "K" -> v - 273.15;
            default -> v; // C
        };
        return switch (to) {
            case "F" -> celsius * 9 / 5 + 32;
            case "K" -> celsius + 273.15;
            default -> celsius;
        };
    }

    private static String format(double r) {
        if (r == Math.floor(r) && !Double.isInfinite(r)) {
            return String.valueOf((long) r);
        }
        return String.valueOf(Math.round(r * 10000.0) / 10000.0);
    }
}
