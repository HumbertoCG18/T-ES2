package com.tes2.toolregistry.config;

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

    // Timeouts defensivos: o circuit breaker do agent-service (20s) só interrompe a thread do
    // agent; sem timeout aqui, um retrieval-service pendurado prenderia threads do tool-registry
    // indefinidamente (knowledge_search → /search). Backstop acima do TL do chamador (20s),
    // para o orçamento dele valer inteiro — o /search inclui embedding frio no Ollama/CPU.
    private static final ClientHttpRequestFactorySettings TIMEOUTS =
            ClientHttpRequestFactorySettings.defaults()
                    .withConnectTimeout(Duration.ofSeconds(3))
                    .withReadTimeout(Duration.ofSeconds(30));

    // Builders passam pelo RestClientBuilderConfigurer do Boot: aplica o ObservationRegistry
    // (client span + header traceparent). Sem isso, a chamada ao retrieval-service sai sem
    // contexto de trace e vira trace órfão no Jaeger (mesmo bug corrigido no agent-service).

    /** Builder com Spring Cloud LoadBalancer (resolve lb://retrieval-service via Eureka). */
    @Bean
    @SuppressWarnings("unused")
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder(RestClientBuilderConfigurer configurer) {
        return configurer.configure(RestClient.builder())
                .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(TIMEOUTS));
    }

    @Bean
        @SuppressWarnings("unused")
        RestClient retrievalRestClient(@LoadBalanced RestClient.Builder lbBuilder, RetrievalProperties props,
                                                                   RestClientBuilderConfigurer configurer) {
        // lb:// usa o builder load-balanced; http:// usa builder simples (ver ADR 0008).
        RestClient.Builder builder = props.baseUrl().startsWith("lb://")
                ? lbBuilder.clone()
                : configurer.configure(RestClient.builder())
                        .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(TIMEOUTS));
        return builder.baseUrl(props.baseUrl()).build();
    }
}
