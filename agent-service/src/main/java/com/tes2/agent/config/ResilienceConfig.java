package com.tes2.agent.config;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.timelimiter.TimeLimiterConfig;
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JCircuitBreakerFactory;
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JConfigBuilder;
import org.springframework.cloud.client.circuitbreaker.Customizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Configuracao do circuit breaker 'llmGateway'.
 * - Abre rapido para a demonstracao (minimo de 3 chamadas, 50% de falha).
 * - Time limiter generoso (600s): modelos locais (Ollama) sao lentos; o default de 1s do
 *   Spring Cloud CircuitBreaker cortaria inferencias legitimas. "Indisponivel" = conexao
 *   recusada (gateway fora), que e o cenario de fallback exigido.
 */
@Configuration
public class ResilienceConfig {

    @Bean
    public Customizer<Resilience4JCircuitBreakerFactory> llmGatewayCustomizer() {
        CircuitBreakerConfig circuitBreaker = CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(10)
                .minimumNumberOfCalls(3)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(3)
                .build();

        TimeLimiterConfig timeLimiter = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(600))
                .build();

        return factory -> factory.configure(builder -> builder
                        .circuitBreakerConfig(circuitBreaker)
                        .timeLimiterConfig(timeLimiter),
                "llmGateway");
    }

    /**
     * Breakers de memory-service e retrieval-service. Diferente do llmGateway, são serviços
     * rápidos: time limiter CURTO. Em fallback, o /chat segue sem histórico / sem RAG (o
     * ciclo nunca quebra por causa de memória/RAG).
     * - memoryService: 3s (Redis/Postgres locais).
     * - retrievalService: 5s (encadeia um embedding no llm-gateway antes da busca).
     */
    @Bean
    public Customizer<Resilience4JCircuitBreakerFactory> memoryRetrievalCustomizer() {
        CircuitBreakerConfig circuitBreaker = CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(10)
                .minimumNumberOfCalls(3)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(3)
                .build();

        TimeLimiterConfig memoryTl = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(3))
                .build();
        TimeLimiterConfig retrievalTl = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(5))
                .build();

        return factory -> {
            factory.configure(builder -> builder
                    .circuitBreakerConfig(circuitBreaker)
                    .timeLimiterConfig(memoryTl), "memoryService");
            factory.configure(builder -> builder
                    .circuitBreakerConfig(circuitBreaker)
                    .timeLimiterConfig(retrievalTl), "retrievalService");
        };
    }
}
