package com.tes2.toolregistry.tools;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Coleta todos os beans {@link Tool} e os expoe (specs + execucao). */
@Component
public class ToolRegistry {

    private final Map<String, Tool> tools;

    public ToolRegistry(List<Tool> toolBeans) {
        this.tools = toolBeans.stream().collect(Collectors.toMap(Tool::name, Function.identity()));
    }

    public List<ToolSpec> specs() {
        return tools.values().stream().map(Tool::spec).toList();
    }

    public boolean has(String name) {
        return tools.containsKey(name);
    }

    public String execute(String name, String argumentsJson) {
        Tool tool = tools.get(name);
        if (tool == null) {
            return "Ferramenta desconhecida: " + name;
        }
        return tool.execute(argumentsJson);
    }
}
