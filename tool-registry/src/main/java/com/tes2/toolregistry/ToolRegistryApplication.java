package com.tes2.toolregistry;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ToolRegistryApplication {

    public static void main(String[] args) {
        SpringApplication.run(ToolRegistryApplication.class, args);
    }
}
