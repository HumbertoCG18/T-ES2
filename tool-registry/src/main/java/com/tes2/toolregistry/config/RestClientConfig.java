package com.tes2.toolregistry.config;

import java.time.Duration;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    // Timeouts defensivos: o circuit breaker do agent-service (3s) só interrompe a thread do
    // agent; sem timeout aqui, um retrieval-service pendurado prenderia threads do tool-registry
    // indefinidamente (knowledge_search → /search). Backstop generoso além do CB do chamador.
    private static final ClientHttpRequestFactorySettings TIMEOUTS =
            ClientHttpRequestFactorySettings.DEFAULTS
                    .withConnectTimeout(Duration.ofSeconds(3))
                    .withReadTimeout(Duration.ofSeconds(10));

    /** Builder com Spring Cloud LoadBalancer (resolve lb://retrieval-service via Eureka). */
    @Bean
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder()
                .requestFactory(ClientHttpRequestFactories.get(TIMEOUTS));
    }

    @Bean
    RestClient retrievalRestClient(@LoadBalanced RestClient.Builder lbBuilder, RetrievalProperties props) {
        // lb:// usa o builder load-balanced; http:// usa builder simples (ver ADR 0008).
        RestClient.Builder builder = props.baseUrl().startsWith("lb://")
                ? lbBuilder.clone()
                : RestClient.builder().requestFactory(ClientHttpRequestFactories.get(TIMEOUTS));
        return builder.baseUrl(props.baseUrl()).build();
    }
}
