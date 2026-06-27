package com.tes2.agent.retrieval.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Resposta do POST /search: trechos ordenados por relevância. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SearchResponse(List<Hit> hits) {
}
