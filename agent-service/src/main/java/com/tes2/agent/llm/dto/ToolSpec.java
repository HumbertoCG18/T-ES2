package com.tes2.agent.llm.dto;

import java.util.Map;

/**
 * Especificacao de ferramenta exposta ao modelo no formato OpenAI:
 * {"type":"function","function":{"name":...,"description":...,"parameters":<json-schema>}}.
 */
public record ToolSpec(String type, Function function) {

    public record Function(String name, String description, Map<String, Object> parameters) {
    }

    public static ToolSpec function(String name, String description, Map<String, Object> parameters) {
        return new ToolSpec("function", new Function(name, description, parameters));
    }
}
