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
import com.tes2.agent.retrieval.dto.ProjectDoc;
import com.tes2.agent.telemetry.TelemetryEventDto;
import com.tes2.agent.telemetry.TelemetryProducer;
import com.tes2.agent.tools.ToolRegistryClient;
import io.micrometer.context.ContextSnapshot;
import io.micrometer.context.ContextSnapshotFactory;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
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
            IMPORTANTE: se voce chamou uma ferramenta e recebeu um resultado (observacao), USE esse
            resultado na resposta final — nunca diga que nao tem acesso ao que a ferramenta ja devolveu.
            Apos observar o resultado das ferramentas, produza uma resposta final clara em portugues.
            """;

    /** Apendice ao system prompt quando o "modo raciocinio" (thinking) esta ligado. */
    private static final String THINKING_ADDENDUM = """

            MODO RACIOCINIO ATIVADO: antes de concluir, pense passo a passo. Comece a resposta com
            uma secao curta "Raciocinio:" listando de 2 a 4 passos do seu raciocinio e, em seguida,
            escreva "Resposta:" com a conclusao final, clara e direta. Seja conciso no raciocinio.
            """;

    /**
     * Politica de esforco: orcamento de iteracoes do ciclo agentico + temperatura + teto de
     * tokens de saida (tempo de geracao e linear nos tokens gerados; "rapido" corta cedo).
     */
    private record EffortPolicy(int iterationBudget, double temperature, int maxTokens) {}

    private final LlmClient llmClient;
    private final ToolRegistryClient toolRegistryClient;
    private final MemoryClient memoryClient;
    private final RetrievalClient retrievalClient;
    private final TelemetryProducer telemetryProducer;
    private final int maxIterations;
    private final int historyLimit;
    private final int ragTopK;
    private final double ragMinScore;
    private final String model;

    public AgentLoop(LlmClient llmClient, ToolRegistryClient toolRegistryClient,
                     MemoryClient memoryClient, RetrievalClient retrievalClient,
                     TelemetryProducer telemetryProducer,
                     LlmProperties llmProps, MemoryProperties memoryProps,
                     RetrievalProperties retrievalProps) {
        this.llmClient = llmClient;
        this.toolRegistryClient = toolRegistryClient;
        this.memoryClient = memoryClient;
        this.retrievalClient = retrievalClient;
        this.telemetryProducer = telemetryProducer;
        this.maxIterations = llmProps.maxIterations();
        this.historyLimit = memoryProps.historyLimit();
        this.ragTopK = retrievalProps.topK();
        this.ragMinScore = retrievalProps.minScore();
        this.model = llmProps.model();
    }

    public AgentResult run(String conversationId, String userMessage, String model,
                           boolean useMemory, boolean useRag, String effort, boolean thinking,
                           String projectId) {
        long startedAt = System.currentTimeMillis();
        String effectiveModel = (model == null || model.isBlank()) ? this.model : model;
        EffortPolicy policy = effortPolicy(effort);
        List<ChatMessage> messages = new ArrayList<>();
        List<String> trace = new ArrayList<>();
        List<String> toolsUsed = new ArrayList<>();
        messages.add(ChatMessage.system(thinking ? SYSTEM_PROMPT + THINKING_ADDENDUM : SYSTEM_PROMPT));
        trace.add("esforco: " + (effort == null ? "equilibrado" : effort)
                + " (orcamento " + policy.iterationBudget() + " iteracoes, temperatura " + policy.temperature() + ")");
        if (thinking) {
            trace.add("modo raciocinio: ligado");
        }

        // Pre-LLM em PARALELO: historico, inventario do projeto, busca RAG e specs de
        // ferramentas sao independentes entre si e cada um ja tem circuit breaker + fallback
        // proprio. Sequencial custava a soma (~300-400ms); em paralelo custa o mais lento.
        // O ContextSnapshot leva o contexto de trace (ThreadLocal) para as threads do pool —
        // sem ele os client spans virariam traces orfaos no Jaeger.
        ContextSnapshot snapshot = ContextSnapshotFactory.builder().build().captureAll();
        CompletableFuture<List<ChatMessage>> historyF = useMemory
                ? CompletableFuture.supplyAsync(inContext(snapshot,
                        () -> memoryClient.recentHistory(conversationId, historyLimit)))
                : CompletableFuture.completedFuture(List.of());
        CompletableFuture<List<ProjectDoc>> projectDocsF = (useRag && projectId != null)
                ? CompletableFuture.supplyAsync(inContext(snapshot,
                        () -> retrievalClient.projectDocuments(projectId)))
                : CompletableFuture.completedFuture(List.of());
        CompletableFuture<List<Hit>> hitsF = useRag
                ? CompletableFuture.supplyAsync(inContext(snapshot,
                        () -> retrievalClient.search(userMessage, ragTopK, projectId)))
                : CompletableFuture.completedFuture(List.of());
        CompletableFuture<List<ToolSpec>> specsF = needsTools(userMessage)
                ? CompletableFuture.supplyAsync(inContext(snapshot, toolRegistryClient::specs))
                : CompletableFuture.completedFuture(null);

        // Memoria (toggle por conversa): historico recente, antes da mensagem atual.
        if (useMemory) {
            List<ChatMessage> history = historyF.join();
            if (!history.isEmpty()) {
                messages.addAll(history);
                trace.add("memoria: " + history.size() + " mensagens de historico carregadas");
            }
        }

        // Conversa dentro de um projeto: injeta SEMPRE o inventário dos documentos indexados
        // (nome + previa). Meta-perguntas ("o que tem no arquivo/projeto?") nao dependem de
        // similaridade semantica — o agente sabe o que existe mesmo sem hit de busca.
        if (useRag && projectId != null) {
            List<ProjectDoc> docs = projectDocsF.join();
            if (!docs.isEmpty()) {
                StringBuilder inv = new StringBuilder(
                        "Conhecimento deste projeto — documentos disponiveis (nome · inicio do conteudo):\n");
                for (ProjectDoc d : docs) {
                    String label = (d.fileName() == null || d.fileName().isBlank()) ? d.docId() : d.fileName();
                    inv.append("- ").append(label);
                    if (d.preview() != null && !d.preview().isBlank()) {
                        inv.append(" · \"").append(d.preview()).append("...\"");
                    }
                    inv.append('\n');
                }
                inv.append("Se o usuario perguntar o que ha no projeto/arquivo ou pedir um resumo, ")
                        .append("responda com base nesta lista e no contexto recuperado — nao diga que nao tem acesso.");
                messages.add(ChatMessage.system(inv.toString()));
                trace.add("projeto: " + docs.size() + " documento(s) no conhecimento do projeto");
            } else {
                trace.add("projeto: nenhum documento indexado neste projeto");
            }
        }

        // RAG (toggle por conversa): so injeta trechos ACIMA do limiar de relevancia.
        // projectId presente = busca com escopo (so documentos daquele projeto); nulo = global.
        List<Hit> hits = hitsF.join().stream()
                .filter(h -> h.score() >= ragMinScore)
                .toList();
        if (projectId != null) {
            trace.add("projeto: busca RAG restrita ao projeto " + projectId);
        }
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

        // Gating de ferramenta: so oferecemos as ferramentas (do tool-registry) ao LLM quando a
        // mensagem parece precisar (digito, ou palavra-chave de data/dados).
        List<ToolSpec> activeTools = specsF.join();

        // Contexto RAG ja injetado => pergunta respondivel pelo documento. Nao oferecer
        // ferramenta nenhuma: (1) knowledge_search seria a mesma busca 2x (uma iteracao
        // extra inteira do LLM); (2) as specs das 7 ferramentas custam ~600-800 tokens de
        // prompt — em CPU local (~15 tok/s de prompt eval) isso e ~1min so de overhead.
        if (activeTools != null && !hits.isEmpty()) {
            activeTools = null;
        }

        String finalReply = null;
        int iterations = 0;
        for (int i = 0; i < policy.iterationBudget() && finalReply == null; i++) {
            iterations = i + 1;
            ChatMessage assistant = llmClient.complete(messages, activeTools, effectiveModel,
                    policy.temperature(), policy.maxTokens());
            messages.add(assistant);

            if (assistant.toolCalls() == null || assistant.toolCalls().isEmpty()) {
                trace.add("resposta final na iteracao " + (i + 1));
                // Conteudo nulo/vazio sem tool_calls e resposta degenerada do modelo; nao deixar
                // cair no fallback de "limite de iteracoes" (linha abaixo), que mascara a causa.
                finalReply = (assistant.content() == null || assistant.content().isBlank())
                        ? "O modelo retornou uma resposta vazia."
                        : assistant.content();
                break;
            }

            for (ToolCall call : assistant.toolCalls()) {
                String toolName = call.function().name();
                String args = call.function().arguments();
                String observation = toolRegistryClient.execute(toolName, args);
                toolsUsed.add(toolName);
                trace.add("acao: " + toolName + "(" + args + ") -> " + observation);
                log.info("Ferramenta {} args {} -> {}", toolName, args, observation);
                messages.add(ChatMessage.tool(call.id(), toolName, observation));
            }
        }

        if (finalReply == null) {
            finalReply = "Nao foi possivel concluir dentro do limite de iteracoes.";
        }

        // Persiste o turno apenas se a memoria estiver ligada (toggle por conversa).
        if (useMemory) {
            memoryClient.appendTurn(conversationId, userMessage, finalReply);
        }

        // Telemetria (best-effort, nao bloqueia).
        long latencyMs = System.currentTimeMillis() - startedAt;
        telemetryProducer.publish(new TelemetryEventDto(
                conversationId, latencyMs, iterations, List.copyOf(toolsUsed), hits.size(),
                effectiveModel, Instant.now()));

        // Citacoes: os trechos do RAG efetivamente injetados como contexto.
        // Prefere o nome do arquivo (file_name, enviado pelo frontend) ao id interno.
        List<Citation> citations = hits.stream()
                .map(h -> new Citation(
                        h.text(),
                        h.score(),
                        h.metadata() == null ? "" : String.valueOf(
                                h.metadata().getOrDefault("file_name",
                                        h.metadata().getOrDefault("doc_id", "")))))
                .toList();

        return new AgentResult(finalReply, trace, citations);
    }

    // Palavras-chave que sugerem necessidade de alguma ferramenta do tool-registry.
    private static final String[] TOOL_HINTS = {
            // datetime / db_query
            "hora", "horas", "data", "dia", "hoje", "agora", "ontem", "amanha", "amanhã",
            "prazo", "quando", "calcul", "soma", "media", "média", "total",
            "quant", "banco", "dados", "consulta", "telemetria", "historico", "histórico",
            "registro", "mensagens", "conversa",
            // unit_convert
            "convert", "converta", "milha", "km", "kg", "grama", "libra", "metro", "celsius", "fahrenheit",
            // random
            "sorte", "sorteie", "sortear", "escolh", "aleat", "dado",
            // text_stats
            "palavra", "caracter", "texto", "linha",
            // knowledge_search
            "documento", "conhecimento", "busca", "procure", "pesquise",
            "arquivo", "pdf", "resum", "conteudo", "conteúdo"
    };

    /**
     * Gating: oferece ferramentas quando a mensagem tem digito OU alguma palavra-chave de
     * data/dados. Saudacoes/testes ("Teste", "oi") nao recebem ferramentas, evitando alucinacao.
     */
    private static boolean needsTools(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        if (message.chars().anyMatch(Character::isDigit)) {
            return true;
        }
        String lower = message.toLowerCase(java.util.Locale.ROOT);
        for (String hint : TOOL_HINTS) {
            if (lower.contains(hint)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Mapeia o nivel de esforco para o orcamento de iteracoes do ciclo agentico e a temperatura.
     * "profundo" deixa o agente iterar mais (raciocinar/usar ferramentas); "rapido" responde em
     * poucas voltas. A temperatura segue baixa (o modelo local alucina tool-calls em temp alta),
     * subindo so um pouco no modo profundo para explorar mais. O orcamento parte do limite
     * configurado (llm.max-iterations) como "equilibrado".
     */
    private EffortPolicy effortPolicy(String effort) {
        int base = this.maxIterations;
        if (effort == null || effort.isBlank()) {
            return new EffortPolicy(base, 0.0, 800);
        }
        return switch (effort.toLowerCase(java.util.Locale.ROOT)) {
            case "rapido", "rápido" -> new EffortPolicy(Math.max(2, base / 2), 0.0, 400);
            case "profundo" -> new EffortPolicy(Math.min(12, base * 2), 0.3, 1600);
            default -> new EffortPolicy(base, 0.1, 800); // equilibrado
        };
    }

    /** Supplier que executa com o contexto de trace capturado (propagacao para o pool). */
    private static <T> Supplier<T> inContext(ContextSnapshot snapshot, Supplier<T> supplier) {
        return () -> {
            try (ContextSnapshot.Scope ignored = snapshot.setThreadLocals()) {
                return supplier.get();
            }
        };
    }
}
