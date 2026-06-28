package com.tes2.agent.agent;

/** Trecho de documento recuperado pelo RAG e usado como contexto (fonte da resposta). */
public record Citation(String text, double score, String docId) {
}
