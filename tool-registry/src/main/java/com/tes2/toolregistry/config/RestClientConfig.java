package com.tes2.toolregistry.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    /** Builder com Spring Cloud LoadBalancer (resolve lb://retrieval-service via Eureka). */
    @Bean
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }

    @Bean
    RestClient retrievalRestClient(@LoadBalanced RestClient.Builder lbBuilder, RetrievalProperties props) {
        // lb:// usa o builder load-balanced; http:// usa builder simples (ver ADR 0008).
        RestClient.Builder builder = props.baseUrl().startsWith("lb://")
                ? lbBuilder.clone()
                : RestClient.builder();
        return builder.baseUrl(props.baseUrl()).build();
    }
}
