package com.tes2.agent.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.io.InputStream;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * Administração de modelos do Ollama (proxy local; ADR 0016), exposta via api-gateway em /models:
 * listar instalados, baixar (com progresso em streaming) e remover. Baixar um modelo exige internet
 * (registry do Ollama) — é ação de **setup**, fora do caminho de execução do /chat (que continua
 * 100% local). Mantém a "entrada única pelo gateway": o frontend nunca fala direto com o Ollama.
 */
@RestController
@RequestMapping("/models")
public class ModelsController {

    private final RestClient ollama;

    public ModelsController(RestClient ollamaRestClient) {
        this.ollama = ollamaRestClient;
    }

    /** Modelos instalados (proxy de GET /api/tags do Ollama). */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> list() {
        String body = ollama.get().uri("/api/tags").retrieve().body(String.class);
        return ResponseEntity.ok(body == null ? "{\"models\":[]}" : body);
    }

    /**
     * Baixa um modelo repassando o progresso do Ollama (NDJSON linha a linha:
     * {status, digest, total, completed}) ao cliente, com flush a cada bloco para a barra de
     * progresso atualizar em tempo real (porcentagem, velocidade e ETA são calculados no cliente).
     */
    @PostMapping(value = "/pull", produces = "application/x-ndjson")
    public StreamingResponseBody pull(@Valid @RequestBody PullRequest req) {
        String model = req.model();
        return out -> ollama.post().uri("/api/pull")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("model", model, "stream", true))
                .exchange((request, response) -> {
                    try (InputStream in = response.getBody()) {
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            out.write(buf, 0, n);
                            out.flush();
                        }
                    }
                    return null;
                });
    }

    /** Remove um modelo instalado (proxy de DELETE /api/delete do Ollama). */
    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        ollama.method(HttpMethod.DELETE).uri("/api/delete")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("model", name))
                .retrieve()
                .toBodilessEntity();
        return ResponseEntity.noContent().build();
    }

    public record PullRequest(@NotBlank String model) {
    }
}
