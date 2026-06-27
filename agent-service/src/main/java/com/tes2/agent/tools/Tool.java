package com.tes2.agent.tools;

import com.tes2.agent.llm.dto.ToolSpec;

/** Ferramenta invocavel pelo agente. Cada implementacao e um bean Spring. */
public interface Tool {

    /** Nome unico, usado pelo modelo para invocar a ferramenta. */
    String name();

    /** Especificacao exposta ao modelo (nome, descricao, JSON schema dos argumentos). */
    ToolSpec spec();

    /** Executa a ferramenta a partir dos argumentos em JSON e devolve a observacao (texto). */
    String execute(String argumentsJson);
}
