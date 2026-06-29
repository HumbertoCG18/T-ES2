package com.tes2.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Acesso direto ao Ollama para administração de modelos (listar/baixar/remover), separado do
 * llm-gateway (que abstrai inferência). Baixar um modelo é ação de **setup** (exige internet, fora
 * do caminho de execução do /chat). Externalizado por env: OLLAMA_BASE_URL (Compose: http://ollama:11434).
 */
@ConfigurationProperties(prefix = "ollama")
public record OllamaProperties(String baseUrl) {

    public OllamaProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:11434";
        }
    }
}
