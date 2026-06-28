package com.tes2.apigateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayRoutesConfig {

    @Bean
    RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("agent-service", r -> r.path("/chat/**").uri("lb://agent-service"))
                // Ingestao assincrona de documentos (Entrega 4) -> produtor no agent-service.
                .route("agent-documents", r -> r.path("/documents/**").uri("lb://agent-service"))
                // Inspecao das ferramentas registradas (tool-registry).
                .route("tool-registry", r -> r.path("/tools/**").uri("lb://tool-registry"))
                // Saude dos servicos (Eureka) para a view de Capacidades.
                .route("agent-services", r -> r.path("/services/**").uri("lb://agent-service"))
                .build();
    }
}
