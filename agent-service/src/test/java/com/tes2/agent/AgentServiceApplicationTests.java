package com.tes2.agent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** Smoke test: o contexto Spring sobe e injeta todos os beans (nao chama o gateway). */
@SpringBootTest
class AgentServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}
