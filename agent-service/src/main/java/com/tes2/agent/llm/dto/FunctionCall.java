package com.tes2.agent.llm.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Chamada de funcao pedida pelo modelo: nome + argumentos em JSON (string). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FunctionCall(String name, String arguments) {
}
