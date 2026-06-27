package com.tes2.agent.retrieval.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Corpo do POST /search do retrieval-service. projectId omitido quando nulo. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SearchRequest(String query, int topK, String projectId) {
}
