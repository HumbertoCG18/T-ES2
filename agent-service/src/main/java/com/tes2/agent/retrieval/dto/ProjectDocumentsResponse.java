package com.tes2.agent.retrieval.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Resposta do GET /projects/{id}/documents do retrieval-service. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProjectDocumentsResponse(List<ProjectDoc> documents) {
}
