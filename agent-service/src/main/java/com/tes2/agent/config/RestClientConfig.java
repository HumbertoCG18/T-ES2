package com.tes2.agent.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    RestClient llmRestClient(LlmProperties props) {
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .build();
    }
}
