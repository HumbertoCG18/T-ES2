package com.tes2.agent.agent;

import com.tes2.agent.config.LlmProperties;
import com.tes2.agent.config.MemoryProperties;
import com.tes2.agent.config.RetrievalProperties;
import com.tes2.agent.llm.LlmClient;
import com.tes2.agent.llm.dto.ChatMessage;
import com.tes2.agent.llm.dto.ToolCall;
import com.tes2.agent.llm.dto.ToolSpec;
import com.tes2.agent.memory.MemoryClient;
import com.tes2.agent.retrieval.RetrievalClient;
import com.tes2.agent.retrieval.dto.Hit;
import com.tes2.agent.telemetry.TelemetryEventDto;
import com.tes2.agent.telemetry.TelemetryProducer;
import com.tes2.agent.tools.ToolRegistry;
import java.time.Instant;
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
 *
 * Telemetria (Entrega 4): ao final publica um evento (latencia, iteracoes, ferramentas,
 * hits de RAG, modelo) na fila telemetry.events — best-effort, sem bloquear a resposta.
 */
@Service
public class AgentLoop {

    private static final Logger log = LoggerFactory.getLogger(AgentLoop.class);

    private static final String SYSTEM_PROMPT = """
            Voce e um assistente conversacional em portugues que opera no ciclo raciocinio -> acao -> observacao.
            Na maioria das mensagens (saudacoes, perguntas gerais, testes como "Teste"), apenas converse
            normalmente e responda direto, SEM chamar nenhuma ferramenta.
            Use a ferramenta 'calculator' SOMENTE quando o usuario pedir explicitamente um calculo aritmetico
            com numeros (ex.: "quanto e (12 + 8) * 3"). Nunca invente uma conta nem envie texto que nao seja
            uma expressao numerica ao calculator.
            Se houver um bloco "Contexto recuperado dos documentos" e a pergunta for sobre esse conteudo,
            responda com base nele, sem usar ferramentas, e nao invente o que nao estiver la.
            Apos observar o resultado das ferramentas, produza uma resposta final clara em portugues.
            """;

    private final LlmClient llmClient;
    private final ToolRegistry toolRegistry;
    private final MemoryClient memoryClient;
    private final RetrievalClient retrievalClient;
    private final TelemetryProducer telemetryProducer;
    private final int maxIterations;
    private final int historyLimit;
    private final int ragTopK;
    private final double ragMinScore;
    private final String model;

    public AgentLoop(LlmClient llmClient, ToolRegistry toolRegistry,
                     MemoryClient memoryClient, RetrievalClient retrievalClient,
                     TelemetryProducer telemetryProducer,
                     LlmProperties llmProps, MemoryProperties memoryProps,
                     RetrievalProperties retrievalProps) {
        this.llmClient = llmClient;
        this.toolRegistry = toolRegistry;
        this.memoryClient = memoryClient;
        this.retrievalClient = retrievalClient;
        this.telemetryProducer = telemetryProducer;
        this.maxIterations = llmProps.maxIterations();
        this.historyLimit = memoryProps.historyLimit();
        this.ragTopK = retrievalProps.topK();
        this.ragMinScore = retrievalProps.minScore();
        this.model = llmProps.model();
    }

    public AgentResult run(String conversationId, String userMessage) {
        long startedAt = System.currentTimeMillis();
        List<ChatMessage> messages = new ArrayList<>();
        List<String> trace = new ArrayList<>();
        List<String> toolsUsed = new ArrayList<>();
        messages.add(ChatMessage.system(SYSTEM_PROMPT));

        // Memoria: historico recente (ordem antiga -> nova), antes da mensagem atual.
        List<ChatMessage> history = memoryClient.recentHistory(conversationId, historyLimit);
        if (!history.isEmpty()) {
            messages.addAll(history);
            trace.add("memoria: " + history.size() + " mensagens de historico carregadas");
        }

        // RAG: so injeta trechos ACIMA do limiar de relevancia (evita ruido em mensagens
        // irrelevantes, ex.: "Teste" recuperaria topK trechos sem sentido).
        List<Hit> hits = retrievalClient.search(userMessage, ragTopK, null).stream()
                .filter(h -> h.score() >= ragMinScore)
                .toList();
        int ragHits = hits.size();
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

        // Gating de ferramenta: o calculator so e oferecido ao LLM quando a mensagem tem digito.
        // O modelo local (llama3.1 8B) aluciná tool-calls (chama o calculator ate para "Teste");
        // nao oferecer a ferramenta quando nao ha aritmetica elimina o problema na raiz.
        List<ToolSpec> activeTools = needsCalculator(userMessage) ? toolRegistry.specs() : null;

        String finalReply = null;
        int iterations = 0;
        for (int i = 0; i < maxIterations && finalReply == null; i++) {
            iterations = i + 1;
            ChatMessage assistant = llmClient.complete(messages, activeTools);
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
                toolsUsed.add(toolName);
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

        // Telemetria (Entrega 4): publica metricas do turno; best-effort, nao bloqueia.
        long latencyMs = System.currentTimeMillis() - startedAt;
        telemetryProducer.publish(new TelemetryEventDto(
                conversationId, latencyMs, iterations, List.copyOf(toolsUsed), ragHits, model, Instant.now()));

        return new AgentResult(finalReply, trace);
    }

    /** O calculator so faz aritmetica -> so o oferecemos quando ha digito na mensagem. */
    private static boolean needsCalculator(String message) {
        return message != null && message.chars().anyMatch(Character::isDigit);
    }
}
