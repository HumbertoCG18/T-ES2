package com.tes2.agent.web;

import java.util.Comparator;
import java.util.List;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Saúde dos serviços registrados no Eureka (para a view de Capacidades).
 * Usa o DiscoveryClient do agent-service: serviços com ≥1 instância estão UP.
 * Observação: llm-gateway e name-server não se registram no Eureka, então não aparecem aqui.
 */
@RestController
@RequestMapping("/services")
public class ServicesController {

    private final DiscoveryClient discoveryClient;

    public ServicesController(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    @GetMapping
    public List<ServiceStatus> services() {
        return discoveryClient.getServices().stream()
                .map(name -> new ServiceStatus(name, discoveryClient.getInstances(name).size()))
                .sorted(Comparator.comparing(ServiceStatus::name))
                .toList();
    }

    public record ServiceStatus(String name, int instances) {
    }
}
