package com.tes2.agent.retrieval;

import com.tes2.agent.retrieval.dto.Hit;
import com.tes2.agent.retrieval.dto.ProjectDoc;
import com.tes2.agent.retrieval.dto.ProjectDocumentsResponse;
import com.tes2.agent.retrieval.dto.SearchRequest;
import com.tes2.agent.retrieval.dto.SearchResponse;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Cliente do retrieval-service (RAG). Protegido pelo circuit breaker 'retrievalService':
 * se o serviço estiver fora (ou lento além do time limiter), o fallback devolve lista vazia
 * e o ciclo agêntico segue sem contexto — sem 5xx para o cliente.
 */
@Component
public class RetrievalClient {

    private static final Logger log = LoggerFactory.getLogger(RetrievalClient.class);
    private static final String CB_NAME = "retrievalService";

    private final RestClient client;
    private final CircuitBreakerFactory<?, ?> circuitBreakerFactory;

    public RetrievalClient(RestClient retrievalRestClient, CircuitBreakerFactory<?, ?> circuitBreakerFactory) {
        this.client = retrievalRestClient;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    /** Busca semântica. Fallback: lista vazia (degrada sem RAG). */
    public List<Hit> search(String query, int topK, String projectId) {
        return circuitBreakerFactory.create(CB_NAME).run(
                () -> doSearch(query, topK, projectId),
                t -> {
                    log.warn("Falha na busca RAG: {}", t.toString());
                    return List.of();
                });
    }

    private List<Hit> doSearch(String query, int topK, String projectId) {
        SearchResponse resp = client.post()
                .uri("/search")
                .body(new SearchRequest(query, topK, projectId))
                .retrieve()
                .body(SearchResponse.class);
        return (resp == null || resp.hits() == null) ? List.of() : resp.hits();
    }

    /**
     * Inventário dos documentos indexados de um projeto (nome + prévia). Permite ao agente
     * responder meta-perguntas ("o que tem neste projeto/arquivo?") sem depender de
     * similaridade semântica. Fallback: lista vazia (o agente segue sem inventário).
     */
    public List<ProjectDoc> projectDocuments(String projectId) {
        return circuitBreakerFactory.create(CB_NAME).run(
                () -> {
                    ProjectDocumentsResponse resp = client.get()
                            .uri("/projects/{id}/documents", projectId)
                            .retrieve()
                            .body(ProjectDocumentsResponse.class);
                    return (resp == null || resp.documents() == null)
                            ? List.<ProjectDoc>of()
                            : resp.documents();
                },
                t -> {
                    log.warn("Falha ao listar documentos do projeto {}: {}", projectId, t.toString());
                    return List.of();
                });
    }
}
