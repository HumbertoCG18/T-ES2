package com.tes2.agent.agent;

import java.util.List;

/**
 * Resultado do ciclo agentico: resposta final, rastro das acoes (observabilidade)
 * e as citacoes (trechos de documentos do RAG usados como contexto).
 */
public record AgentResult(String reply, List<String> trace, List<Citation> citations) {
}
