package com.tes2.agent.retrieval.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Documento indexado de um projeto (inventário do GET /projects/{id}/documents). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProjectDoc(String docId, String fileName, int chunks, String preview) {
}
