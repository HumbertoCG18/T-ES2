package com.tes2.toolregistry.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CalculatorToolTest {

    private final CalculatorTool tool = new CalculatorTool();

    @Test
    void avaliaSomaSimples() {
        assertEquals("4", tool.execute("{\"expression\":\"2 + 2\"}"));
    }

    @Test
    void respeitaPrecedenciaEParenteses() {
        assertEquals("20", tool.execute("{\"expression\":\"(2 + 3) * 4\"}"));
    }

    @Test
    void divisaoComDecimais() {
        assertEquals("2.5", tool.execute("{\"expression\":\"5 / 2\"}"));
    }

    @Test
    void expressaoInvalidaRetornaErro() {
        assertTrue(tool.execute("{\"expression\":\"2 +\"}").startsWith("Erro"));
    }
}
