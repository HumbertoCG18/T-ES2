package com.tes2.agent.retrieval.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

/** Trecho recuperado pelo retrieval-service. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Hit(String text, double score, Map<String, Object> metadata) {
}
