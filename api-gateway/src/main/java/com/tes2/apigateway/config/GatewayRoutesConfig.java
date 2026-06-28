package com.tes2.apigateway.config;

import java.util.Optional;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

@Configuration
public class GatewayRoutesConfig {

    /**
     * Rate limiter (token bucket) no Redis: 5 req/s, rajada até 10. Aplicado ao /chat para
     * proteger o caminho mais caro (LLM). Estourar o limite => HTTP 429.
     */
    @Bean
    RedisRateLimiter chatRateLimiter() {
        return new RedisRateLimiter(5, 10);
    }

    /** Chave do rate limit por IP do cliente (cai para "unknown" se ausente). */
    @Bean
    KeyResolver ipKeyResolver() {
        return exchange -> Mono.just(
                Optional.ofNullable(exchange.getRequest().getRemoteAddress())
                        .map(addr -> addr.getAddress().getHostAddress())
                        .orElse("unknown"));
    }

    @Bean
    RouteLocator routes(RouteLocatorBuilder builder, RedisRateLimiter chatRateLimiter,
                        KeyResolver ipKeyResolver) {
        return builder.routes()
                // /chat com rate limiting (entrada principal, caminho do LLM).
                .route("agent-service", r -> r.path("/chat/**")
                        .filters(f -> f.requestRateLimiter(c -> c
                                .setRateLimiter(chatRateLimiter)
                                .setKeyResolver(ipKeyResolver)))
                        .uri("lb://agent-service"))
                // Ingestao assincrona de documentos (Entrega 4) -> produtor no agent-service.
                .route("agent-documents", r -> r.path("/documents/**").uri("lb://agent-service"))
                // Inspecao das ferramentas registradas (tool-registry).
                .route("tool-registry", r -> r.path("/tools/**").uri("lb://tool-registry"))
                // Saude dos servicos (Eureka) para a view de Capacidades.
                .route("agent-services", r -> r.path("/services/**").uri("lb://agent-service"))
                // Ver/gerenciar memoria de uma conversa (proxy do agent-service ao memory-service).
                .route("agent-memory", r -> r.path("/memory/**").uri("lb://agent-service"))
                .build();
    }
}
