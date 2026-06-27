package com.tes2.toolregistry.tools;

import java.util.Map;

/**
 * Especificacao de ferramenta no formato OpenAI:
 * {"type":"function","function":{"name":...,"description":...,"parameters":<json-schema>}}.
 * Mesma forma do ToolSpec do agent-service (contrato JSON entre os dois servicos).
 */
public record ToolSpec(String type, Function function) {

    public record Function(String name, String description, Map<String, Object> parameters) {
    }

    public static ToolSpec function(String name, String description, Map<String, Object> parameters) {
        return new ToolSpec("function", new Function(name, description, parameters));
    }
}
