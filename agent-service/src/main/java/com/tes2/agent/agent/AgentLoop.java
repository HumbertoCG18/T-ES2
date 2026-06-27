package com.tes2.agent.agent;

import com.tes2.agent.config.LlmProperties;
import com.tes2.agent.llm.LlmClient;
import com.tes2.agent.llm.dto.ChatMessage;
import com.tes2.agent.llm.dto.ToolCall;
import com.tes2.agent.tools.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Nucleo da plataforma: executa o ciclo raciocinio -> acao -> observacao.
 * A cada iteracao chama o LLM (via gateway); se o modelo pedir ferramentas,
 * executa-as, devolve a observacao e repete ate produzir a resposta final
 * ou atingir o limite de iteracoes.
 */
@Service
public class AgentLoop {

    private static final Logger log = LoggerFactory.getLogger(AgentLoop.class);

    private static final String SYSTEM_PROMPT = """
            Voce e um assistente que resolve tarefas em um ciclo raciocinio -> acao -> observacao.
            Quando precisar de calculo aritmetico, use a ferramenta 'calculator' em vez de calcular de cabeca.
            Apos observar o resultado das ferramentas, produza uma resposta final clara em portugues.
            """;

    private final LlmClient llmClient;
    private final ToolRegistry toolRegistry;
    private final int maxIterations;

    public AgentLoop(LlmClient llmClient, ToolRegistry toolRegistry, LlmProperties props) {
        this.llmClient = llmClient;
        this.toolRegistry = toolRegistry;
        this.maxIterations = props.maxIterations();
    }

    public AgentResult run(String userMessage) {
        List<ChatMessage> messages = new ArrayList<>();
        List<String> trace = new ArrayList<>();
        messages.add(ChatMessage.system(SYSTEM_PROMPT));
        messages.add(ChatMessage.user(userMessage));

        for (int i = 0; i < maxIterations; i++) {
            ChatMessage assistant = llmClient.complete(messages, toolRegistry.specs());
            messages.add(assistant);

            if (assistant.toolCalls() == null || assistant.toolCalls().isEmpty()) {
                trace.add("resposta final na iteracao " + (i + 1));
                return new AgentResult(assistant.content(), trace);
            }

            for (ToolCall call : assistant.toolCalls()) {
                String toolName = call.function().name();
                String args = call.function().arguments();
                String observation = toolRegistry.execute(toolName, args);
                trace.add("acao: " + toolName + "(" + args + ") -> " + observation);
                log.info("Ferramenta {} args {} -> {}", toolName, args, observation);
                messages.add(ChatMessage.tool(call.id(), toolName, observation));
            }
        }

        return new AgentResult("Nao foi possivel concluir dentro do limite de iteracoes.", trace);
    }
}
