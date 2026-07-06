package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Busca semântica nos documentos do usuário (RAG) como ferramenta explícita: o agente decide
 * quando consultar a base de conhecimento. Chama o retrieval-service (/search).
 */
@Component
public class KnowledgeSearchTool implements Tool {

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient retrievalRestClient;

    public KnowledgeSearchTool(RestClient retrievalRestClient) {
        this.retrievalRestClient = retrievalRestClient;
    }

    @Override
    public String name() {
        return "knowledge_search";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "query", Map.of("type", "string", "description", "O que buscar nos documentos"),
                        "topK", Map.of("type", "integer", "description", "Nº de trechos (padrão 4)")),
                "required", List.of("query"));
        return ToolSpec.function(name(),
                "Busca semântica nos documentos do usuário (RAG). Use para responder com base no conhecimento ingerido.",
                parameters);
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            JsonNode node = mapper.readTree(argumentsJson);
            String query = node.path("query").asText("");
            int topK = node.path("topK").asInt(4);
            if (query.isBlank()) {
                return "Consulta vazia.";
            }

            SearchResponse resp = retrievalRestClient.post()
                    .uri("/search")
                    .body(new SearchRequest(query, topK))
                    .retrieve()
                    .body(SearchResponse.class);

            if (resp == null || resp.hits() == null || resp.hits().isEmpty()) {
                return "Nenhum trecho relevante encontrado nos documentos.";
            }
            StringBuilder sb = new StringBuilder();
            for (Hit h : resp.hits()) {
                sb.append("- (").append(Math.round(h.score() * 100)).append("%) ")
                        .append(h.text()).append('\n');
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return "Erro na busca de conhecimento: " + e.getMessage();
        }
    }

    private record SearchRequest(String query, int topK) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Hit(String text, double score) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record SearchResponse(List<Hit> hits) {
    }
}
