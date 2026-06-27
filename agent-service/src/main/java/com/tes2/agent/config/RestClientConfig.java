package com.tes2.agent.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    /** Cliente do llm-gateway: baseUrl FIXA (o llm-gateway não está no Eureka). Não mexer. */
    @Bean
    RestClient llmRestClient(LlmProperties props) {
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .build();
    }

    /**
     * Builder com Spring Cloud LoadBalancer (resolve lb://&lt;serviço&gt; via Eureka).
     * Vem junto do eureka-client. Usado só pelos serviços novos (memory/retrieval).
     */
    @Bean
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }

    @Bean
    RestClient memoryRestClient(@LoadBalanced RestClient.Builder lbBuilder, MemoryProperties props) {
        return buildClient(lbBuilder, props.baseUrl());
    }

    @Bean
    RestClient retrievalRestClient(@LoadBalanced RestClient.Builder lbBuilder, RetrievalProperties props) {
        return buildClient(lbBuilder, props.baseUrl());
    }

    @Bean
    RestClient toolRestClient(@LoadBalanced RestClient.Builder lbBuilder, ToolRegistryProperties props) {
        return buildClient(lbBuilder, props.baseUrl());
    }

    /**
     * lb://  → usa o builder load-balanced (host = nome lógico no Eureka).
     * http:// → builder simples (URL fixa); o interceptor de LB trataria o host como serviceId,
     * por isso a URL fixa NÃO pode passar pelo client load-balanced (ver R1/ADR 0008).
     */
    private static RestClient buildClient(RestClient.Builder lbBuilder, String baseUrl) {
        RestClient.Builder builder = baseUrl.startsWith("lb://")
                ? lbBuilder.clone()
                : RestClient.builder();
        return builder.baseUrl(baseUrl).build();
    }
}
