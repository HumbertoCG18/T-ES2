package com.tes2.agent.config;

import java.time.Duration;
import org.springframework.boot.autoconfigure.web.client.RestClientBuilderConfigurer;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    /**
     * Todos os builders passam pelo RestClientBuilderConfigurer do Boot: ele aplica o
     * ObservationRegistry (client span + header traceparent). Sem isso, as chamadas saem
     * sem contexto de trace e cada serviço downstream abre um trace órfão no Jaeger.
     */

    /**
     * Cliente do llm-gateway: baseUrl FIXA (o llm-gateway não está no Eureka). Não mexer.
     * Connect timeout curto: container PARADO não recusa conexão (IP morto = SYN pendura);
     * sem isso a 1ª falha da demo de resiliência leva 3-7s até o fallback. Read timeout
     * NÃO é definido aqui — inferência longa é legítima e o TimeLimiter (600s) é o teto.
     */
    @Bean
    RestClient llmRestClient(LlmProperties props, RestClientBuilderConfigurer configurer) {
        return configurer.configure(RestClient.builder())
                .baseUrl(props.baseUrl())
                .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(
                        ClientHttpRequestFactorySettings.defaults()
                                .withConnectTimeout(Duration.ofSeconds(2))))
                .build();
    }

    /**
     * Cliente do Ollama para administração de modelos (URL fixa, não está no Eureka). Sem read
     * timeout: o download de um modelo (pull em streaming) pode levar minutos.
     */
    @Bean
    RestClient ollamaRestClient(OllamaProperties props, RestClientBuilderConfigurer configurer) {
        return configurer.configure(RestClient.builder())
                .baseUrl(props.baseUrl())
                .build();
    }

    /**
     * Builder com Spring Cloud LoadBalancer (resolve lb://&lt;serviço&gt; via Eureka).
     * Vem junto do eureka-client. Usado só pelos serviços novos (memory/retrieval).
     */
    @Bean
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder(RestClientBuilderConfigurer configurer) {
        return configurer.configure(RestClient.builder());
    }

    @Bean
    RestClient memoryRestClient(@LoadBalanced RestClient.Builder lbBuilder, MemoryProperties props,
                                RestClientBuilderConfigurer configurer) {
        return buildClient(lbBuilder, configurer, props.baseUrl());
    }

    @Bean
    RestClient retrievalRestClient(@LoadBalanced RestClient.Builder lbBuilder, RetrievalProperties props,
                                   RestClientBuilderConfigurer configurer) {
        return buildClient(lbBuilder, configurer, props.baseUrl());
    }

    @Bean
    RestClient toolRestClient(@LoadBalanced RestClient.Builder lbBuilder, ToolRegistryProperties props,
                              RestClientBuilderConfigurer configurer) {
        return buildClient(lbBuilder, configurer, props.baseUrl());
    }

    /**
     * lb://  → usa o builder load-balanced (host = nome lógico no Eureka).
     * http:// → builder simples (URL fixa); o interceptor de LB trataria o host como serviceId,
     * por isso a URL fixa NÃO pode passar pelo client load-balanced (ver R1/ADR 0008).
     */
    private static RestClient buildClient(RestClient.Builder lbBuilder, RestClientBuilderConfigurer configurer,
                                          String baseUrl) {
        RestClient.Builder builder = baseUrl.startsWith("lb://")
                ? lbBuilder.clone()
                : configurer.configure(RestClient.builder());
        return builder.baseUrl(baseUrl).build();
    }
}
