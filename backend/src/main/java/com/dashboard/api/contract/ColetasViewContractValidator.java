package com.dashboard.api.contract;

import com.dashboard.api.config.ConsultaAnalitica;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Component;

@Component
public class ColetasViewContractValidator {

    private static final List<String> COLUNAS_OBRIGATORIAS = List.of(
            "ID", "Coleta", "Solicitacao", "Agendamento", "Finalizacao", "Status",
            "Excluída na Origem", "Volumes", "Peso Real", "Peso Taxado", "Valor NF",
            "Numero Manifesto", "Cliente", "Cidade", "UF", "Região da Coleta",
            "Região Logística", "Filial", "Usuario", "Motivo Cancel.", "Data de extracao"
    );

    private static final Set<String> TIPOS_DATA_NATIVOS = Set.of(
            "date",
            "datetime",
            "datetime2",
            "smalldatetime",
            "datetimeoffset"
    );

    private final JdbcOperations jdbcTemplate;
    private volatile boolean validado;

    public ColetasViewContractValidator(@ConsultaAnalitica JdbcOperations jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void validarSolicitacaoNativa() {
        if (validado) {
            return;
        }

        validarColunasPublicadas();

        String tipo = jdbcTemplate.query("""
                SELECT system_type_name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) [Solicitacao] FROM dbo.vw_coletas_powerbi',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND name = N'Solicitacao'
                """, rs -> rs.next() ? rs.getString(1) : null);

        if (tipo == null || tipo.isBlank()) {
            throw new IllegalStateException("Contrato invalido: coluna vw_coletas_powerbi.[Solicitacao] nao encontrada.");
        }

        String normalizado = tipo.trim().toLowerCase(Locale.ROOT).replaceFirst("\\(.*\\)$", "");
        if (!TIPOS_DATA_NATIVOS.contains(normalizado)) {
            throw new IllegalStateException(
                    "Contrato invalido: vw_coletas_powerbi.[Solicitacao] deve ser tipo de data nativo no ETL, mas veio como "
                            + tipo + ". Corrija dbo.coletas.request_date/view no repositorio etl-extracao-dados; "
                            + "o Dashboard nao aplicara conversao dinamica em tempo de consulta."
            );
        }

        validarRegiaoLogisticaPublicada();
        validarExclusaoOrigemPublicada();
        validarTiposConsumidos();
        validado = true;
    }

    private void validarTiposConsumidos() {
        List<Map<String, Object>> metadados = jdbcTemplate.queryForList("""
                SELECT name AS coluna, system_type_name AS tipo
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) * FROM dbo.vw_coletas_powerbi', NULL, 0
                )
                WHERE error_number IS NULL AND is_hidden = 0 AND name IS NOT NULL
                """);

        List<String> incompativeis = COLUNAS_OBRIGATORIAS.stream()
                .filter(coluna -> metadados.stream().noneMatch(campo ->
                        coluna.equals(campo.get("coluna"))
                                && tipoCompativel(coluna, campo.get("tipo"))))
                .toList();
        if (!incompativeis.isEmpty()) {
            throw new IllegalStateException(
                    "Dados de Coletas com tipos incompatíveis ou não informados nas colunas "
                            + String.join(", ", incompativeis)
                            + ". Corrija a publicação do ETL antes de usar o painel."
            );
        }
    }

    private boolean tipoCompativel(String coluna, Object tipoPublicado) {
        if (!(tipoPublicado instanceof String tipo) || tipo.isBlank()) {
            return false;
        }
        String base = tipo.trim().toLowerCase(Locale.ROOT).replaceFirst("\\(.*\\)$", "");
        Set<String> inteiros = Set.of("tinyint", "smallint", "int", "bigint");
        Set<String> textos = Set.of("char", "nchar", "varchar", "nvarchar", "text", "ntext");
        return switch (coluna) {
            case "ID" -> textos.contains(base) || inteiros.contains(base);
            case "Coleta", "Numero Manifesto" -> inteiros.contains(base);
            case "Volumes" -> Set.of("tinyint", "smallint", "int").contains(base);
            case "Solicitacao", "Agendamento", "Finalizacao" -> TIPOS_DATA_NATIVOS.contains(base);
            case "Data de extracao" -> Set.of("datetime", "datetime2", "smalldatetime").contains(base);
            case "Excluída na Origem" -> "bit".equals(base);
            case "Peso Real", "Peso Taxado", "Valor NF" -> inteiros.contains(base)
                    || Set.of("decimal", "numeric", "money", "smallmoney").contains(base);
            default -> textos.contains(base);
        };
    }

    private void validarColunasPublicadas() {
        List<String> publicadas = jdbcTemplate.queryForList("""
                SELECT name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) * FROM dbo.vw_coletas_powerbi',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND is_hidden = 0
                  AND name IS NOT NULL
                """, String.class);

        List<String> ausentes = COLUNAS_OBRIGATORIAS.stream()
                .filter(coluna -> !publicadas.contains(coluna))
                .toList();

        if (!ausentes.isEmpty()) {
            throw new IllegalStateException(
                    "Dados de Coletas incompletos: faltam as colunas "
                            + String.join(", ", ausentes)
                            + ". Complete a publicação do ETL antes de usar o painel."
            );
        }
    }

    private void validarRegiaoLogisticaPublicada() {
        String tipo = jdbcTemplate.query("""
                SELECT system_type_name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) [Região Logística] FROM dbo.vw_coletas_powerbi',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND name = N'Região Logística'
                """, rs -> rs.next() ? rs.getString(1) : null);

        if (tipo == null || tipo.isBlank()) {
            throw new IllegalStateException(
                    "Contrato invalido: vw_coletas_powerbi.[Região Logística] nao encontrada. "
                            + "Republique a view no repositorio etl-extracao-dados antes de iniciar o Dashboard."
            );
        }
    }

    private void validarExclusaoOrigemPublicada() {
        String tipo = jdbcTemplate.query("""
                SELECT system_type_name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) [Excluída na Origem] FROM dbo.vw_coletas_powerbi',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND name = N'Excluída na Origem'
                """, rs -> rs.next() ? rs.getString(1) : null);

        if (tipo == null || tipo.isBlank()) {
            throw new IllegalStateException(
                    "Contrato invalido: vw_coletas_powerbi.[Excluída na Origem] nao encontrada. "
                            + "Republique a view no repositorio etl-extracao-dados antes de iniciar o Dashboard."
            );
        }

        if (!"bit".equalsIgnoreCase(tipo.trim())) {
            throw new IllegalStateException(
                    "Contrato invalido: vw_coletas_powerbi.[Excluída na Origem] deve ser bit, mas veio como "
                            + tipo + ". Corrija dbo.vw_coletas_powerbi no repositorio etl-extracao-dados."
            );
        }
    }
}
