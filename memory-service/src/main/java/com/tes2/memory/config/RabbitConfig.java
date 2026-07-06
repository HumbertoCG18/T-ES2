package com.tes2.memory.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.DefaultJackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.amqp.SimpleRabbitListenerContainerFactoryConfigurer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Mensageria (Entrega 4). O memory-service é CONSUMIDOR da fila telemetry.events (publicada
 * pelo agent-service) e persiste cada evento no Postgres.
 *
 * Decoupling de tipos: o produtor adiciona o header __TypeId__ com o nome da classe no pacote
 * dele; usamos TypePrecedence.INFERRED para desserializar para o tipo do parâmetro do
 * @RabbitListener (TelemetryEventDto local), ignorando o header. O ObjectMapper do Boot
 * (com JavaTimeModule) lê o Instant em ISO-8601.
 */
@Configuration
public class RabbitConfig {

    public static final String TELEMETRY_QUEUE = "telemetry.events";

    @Bean
    Queue telemetryQueue() {
        return new Queue(TELEMETRY_QUEUE, true); // durable
    }

    @Bean
    MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter(objectMapper);
        DefaultJackson2JavaTypeMapper typeMapper = new DefaultJackson2JavaTypeMapper();
        typeMapper.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        converter.setJavaTypeMapper(typeMapper);
        return converter;
    }

    /**
     * Nome 'rabbitListenerContainerFactory' = sobrescreve a factory default, então o
     * @RabbitListener a usa sem precisar de containerFactory explícito.
     */
    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            SimpleRabbitListenerContainerFactoryConfigurer configurer,
            MessageConverter jsonMessageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        configurer.configure(factory, connectionFactory);
        factory.setMessageConverter(jsonMessageConverter);
        return factory;
    }
}
