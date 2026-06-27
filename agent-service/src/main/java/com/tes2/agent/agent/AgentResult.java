package com.tes2.agent.agent;

import java.util.List;

/** Resultado do ciclo agentico: resposta final + rastro das acoes (observabilidade basica). */
public record AgentResult(String reply, List<String> trace) {
}
