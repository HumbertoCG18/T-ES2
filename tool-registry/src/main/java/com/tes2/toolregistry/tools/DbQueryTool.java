package com.tes2.toolregistry.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Consulta read-only ao Postgres da plataforma (db memory). Exemplo de "consulta a base de dados"
 * citado pela spec. SOMENTE SELECT: rejeita ';', comentarios e qualquer DDL/DML — sem risco de escrita.
 */
@Component
public class DbQueryTool implements Tool {

    private static final int MAX_ROWS = 20;
    private static final int FETCH_CAP = 1000;   // teto de linhas trazidas do BD (evita OOM)
    private static final int QUERY_TIMEOUT_S = 5; // barra pg_sleep e joins gigantes
    private static final List<String> FORBIDDEN = List.of(
            "insert", "update", "delete", "drop", "alter", "create", "truncate",
            "grant", "revoke", "copy", "call", "merge", "comment", "vacuum",
            // Funções perigosas (SELECT-based): DoS e leitura de arquivos do servidor.
            "pg_sleep", "pg_read_file", "pg_read_binary_file", "pg_ls_dir",
            "lo_import", "lo_export", "dblink");

    private final ObjectMapper mapper = new ObjectMapper();
    private final JdbcTemplate jdbc;

    public DbQueryTool(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.jdbc.setMaxRows(FETCH_CAP);
        this.jdbc.setQueryTimeout(QUERY_TIMEOUT_S);
    }

    @Override
    public String name() {
        return "db_query";
    }

    @Override
    public ToolSpec spec() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "sql", Map.of(
                                "type", "string",
                                "description", "Consulta SQL SELECT (read-only). Tabelas: "
                                        + "conversation_message(conversation_id, role, content, created_at), "
                                        + "telemetry_event(conversation_id, latency_ms, iterations, rag_hits, tools_used, model, created_at)."
                        )
                ),
                "required", List.of("sql")
        );
        return ToolSpec.function(
                name(),
                "Executa uma consulta SQL SELECT read-only no banco da plataforma e retorna as linhas.",
                parameters
        );
    }

    @Override
    public String execute(String argumentsJson) {
        try {
            JsonNode node = mapper.readTree(argumentsJson);
            String sql = node.path("sql").asText("").trim();

            String rejection = validate(sql);
            if (rejection != null) {
                return "Consulta rejeitada: " + rejection;
            }

            List<Map<String, Object>> rows = jdbc.queryForList(sql);
            if (rows.isEmpty()) {
                return "Sem resultados.";
            }
            return format(rows);
        } catch (Exception e) {
            return "Erro na consulta: " + e.getMessage();
        }
    }

    /** Retorna a razao da rejeicao, ou null se a consulta for um SELECT seguro. */
    private String validate(String sql) {
        if (sql.isBlank()) {
            return "consulta vazia";
        }
        String lower = sql.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("select") && !lower.startsWith("with")) {
            return "apenas SELECT/WITH permitido";
        }
        if (sql.contains(";") || lower.contains("--") || lower.contains("/*")) {
            return "caracteres proibidos (; ou comentarios)";
        }
        for (String kw : FORBIDDEN) {
            if (lower.matches("(?s).*\\b" + kw + "\\b.*")) {
                return "operacao proibida: " + kw;
            }
        }
        return null;
    }

    private String format(List<Map<String, Object>> rows) {
        StringBuilder sb = new StringBuilder();
        int shown = Math.min(rows.size(), MAX_ROWS);
        for (int i = 0; i < shown; i++) {
            sb.append(rows.get(i)).append('\n');
        }
        if (rows.size() > MAX_ROWS) {
            sb.append("... (").append(rows.size() - MAX_ROWS).append(" linhas omitidas)");
        }
        return sb.toString().trim();
    }
}
