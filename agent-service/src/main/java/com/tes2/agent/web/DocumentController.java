package com.tes2.agent.web;

import com.tes2.agent.ingestion.IngestionMessage;
import com.tes2.agent.ingestion.IngestionProducer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.amqp.AmqpException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Ingestão assíncrona de documentos (Entrega 4). Publica o documento na fila e responde 202;
 * o retrieval-service consome no seu ritmo e indexa no ChromaDB. Exposto pelo api-gateway
 * (Path=/documents/**). A ingestão síncrona direta continua disponível em retrieval-service /ingest.
 */
@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final IngestionProducer producer;

    public DocumentController(IngestionProducer producer) {
        this.producer = producer;
    }

    @PostMapping("/ingest")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public IngestionAccepted ingest(@Valid @RequestBody IngestionRequest req) {
        try {
            producer.publish(new IngestionMessage(req.docId(), req.projectId(), req.text(), req.metadata()));
        } catch (AmqpException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Broker de mensageria indisponível; tente novamente.", ex);
        }
        return new IngestionAccepted(req.docId(), "queued");
    }

    public record IngestionRequest(
            @NotBlank String docId,
            String projectId,
            @NotBlank String text,
            Map<String, Object> metadata) {
    }

    public record IngestionAccepted(String docId, String status) {
    }
}
