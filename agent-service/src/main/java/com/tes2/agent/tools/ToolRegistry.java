package com.tes2.agent.tools;

import com.tes2.agent.llm.dto.ToolSpec;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Registro local de ferramentas. Coleta todos os beans {@link Tool} e os expoe ao agente.
 * (Na Entrega 5 evolui para consultar o microsservico tool-registry remoto.)
 */
@Component
public class ToolRegistry {

    private final Map<String, Tool> tools;

    public ToolRegistry(List<Tool> toolBeans) {
        this.tools = toolBeans.stream().collect(Collectors.toMap(Tool::name, Function.identity()));
    }

    public List<ToolSpec> specs() {
        return tools.values().stream().map(Tool::spec).toList();
    }

    public String execute(String name, String argumentsJson) {
        Tool tool = tools.get(name);
        if (tool == null) {
            return "Ferramenta desconhecida: " + name;
        }
        return tool.execute(argumentsJson);
    }
}
