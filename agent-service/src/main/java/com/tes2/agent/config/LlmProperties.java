package com.tes2.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuracao de acesso ao llm-gateway (LiteLLM), externalizada via application.yaml
 * para que o mesmo artefato sirva ao Docker Compose (local) e ao Kubernetes (producao).
 */
@ConfigurationProperties(prefix = "llm")
public record LlmProperties(String baseUrl, String model, int maxIterations) {
}
