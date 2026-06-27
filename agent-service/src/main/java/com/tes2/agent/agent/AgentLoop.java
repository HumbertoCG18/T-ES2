package com.tes2.agent.agent;

import com.tes2.agent.config.LlmProperties;
import com.tes2.agent.config.MemoryProperties;
import com.tes2.agent.config.RetrievalProperties;
import com.tes2.agent.llm.LlmClient;
import com.tes2.agent.llm.dto.ChatMessage;
import com.tes2.agent.llm.dto.ToolCall;
import com.tes2.agent.memory.MemoryClient;
import com.tes2.agent.retrieval.RetrievalClient;
import com.tes2.agent.retrieval.dto.Hit;
import com.tes2.agent.tools.ToolRegistry;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Nucleo da plataforma: executa o ciclo raciocinio -> acao -> observacao.
 * A cada iteracao chama o LLM (via gateway); se o modelo pedir ferramentas,
 * executa-as, devolve a observacao e repete ate produzir a resposta final
 * ou atingir o limite de iteracoes.
 *
 * Memoria + RAG (Entrega 3): antes do loop carrega o historico recente da conversa
 * (memory-service) e injeta contexto recuperado dos documentos (retrieval-service) como
 * uma system message dedicada; ao final persiste o turno (user + assistant). Ambos os
 * acessos sao tolerantes a falha (circuit breaker): sem memoria/RAG o ciclo segue normal.
 */
@Service
public class AgentLoop {

    private static final Logger log = LoggerFactory.getLogger(AgentLoop.class);

    private static final String SYSTEM_PROMPT = """
            Voce e um assistente que resolve tarefas em um ciclo raciocinio -> acao -> observacao.
            Use a ferramenta 'calculator' SOMENTE para expressoes aritmeticas numericas (ex.: (12 + 8) * 3).
            Nunca envie texto que nao seja uma conta numerica ao calculator.
            Se houver um bloco "Contexto recuperado dos documentos" e a pergunta for sobre esse conteudo,
            responda diretamente com base nele, sem usar ferramentas, e nao invente o que nao estiver la.
            Apos observar o resultado das ferramentas, produza uma resposta final clara em portugues.
            """;

    private final LlmClient llmClient;
    private final ToolRegistry toolRegistry;
    private final MemoryClient memoryClient;
    private final RetrievalClient retrievalClient;
    private final int maxIterations;
    private final int historyLimit;
    private final int ragTopK;

    public AgentLoop(LlmClient llmClient, ToolRegistry toolRegistry,
                     MemoryClient memoryClient, RetrievalClient retrievalClient,
                     LlmProperties llmProps, MemoryProperties memoryProps,
                     RetrievalProperties retrievalProps) {
        this.llmClient = llmClient;
        this.toolRegistry = toolRegistry;
        this.memoryClient = memoryClient;
        this.retrievalClient = retrievalClient;
        this.maxIterations = llmProps.maxIterations();
        this.historyLimit = memoryProps.historyLimit();
        this.ragTopK = retrievalProps.topK();
    }

    public AgentResult run(String conversationId, String userMessage) {
        List<ChatMessage> messages = new ArrayList<>();
        List<String> trace = new ArrayList<>();
        messages.add(ChatMessage.system(SYSTEM_PROMPT));

        // Memoria: historico recente (ordem antiga -> nova), antes da mensagem atual.
        List<ChatMessage> history = memoryClient.recentHistory(conversationId, historyLimit);
        if (!history.isEmpty()) {
            messages.addAll(history);
            trace.add("memoria: " + history.size() + " mensagens de historico carregadas");
        }

        // RAG: trechos recuperados dos documentos do usuario, como system message de apoio.
        List<Hit> hits = retrievalClient.search(userMessage, ragTopK, null);
        if (!hits.isEmpty()) {
            StringBuilder ctx = new StringBuilder(
                    "Contexto recuperado dos documentos do usuario (use se for relevante; nao invente):\n");
            for (Hit h : hits) {
                ctx.append("- ").append(h.text()).append('\n');
            }
            messages.add(ChatMessage.system(ctx.toString()));
            trace.add("rag: " + hits.size() + " trechos recuperados");
        }

        messages.add(ChatMessage.user(userMessage));

        String finalReply = null;
        for (int i = 0; i < maxIterations && finalReply == null; i++) {
            ChatMessage assistant = llmClient.complete(messages, toolRegistry.specs());
            messages.add(assistant);

            if (assistant.toolCalls() == null || assistant.toolCalls().isEmpty()) {
                trace.add("resposta final na iteracao " + (i + 1));
                finalReply = assistant.content();
                break;
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

        if (finalReply == null) {
            finalReply = "Nao foi possivel concluir dentro do limite de iteracoes.";
        }

        // Persiste o turno limpo (user + assistant final); 'tool' intermediarias ficam efemeras (R5).
        memoryClient.appendTurn(conversationId, userMessage, finalReply);

        return new AgentResult(finalReply, trace);
    }
}
