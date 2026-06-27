package com.tes2.agent.ingestion;

import java.util.Map;

/**
 * Mensagem publicada na fila document.ingest. Espelha o contrato do /ingest do retrieval-service
 * (docId, projectId, text, metadata) — o consumer Python desserializa direto deste JSON.
 */
public record IngestionMessage(String docId, String projectId, String text, Map<String, Object> metadata) {
}
