package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.etl.EtlCategoriaErroDTO;
import com.dashboard.api.dto.etl.EtlInsercoesAtualizacoesPointDTO;
import com.dashboard.api.dto.etl.EtlLogExtracaoAuditoriaDTO;
import com.dashboard.api.dto.etl.EtlSaudeChartsDTO;
import com.dashboard.api.dto.etl.EtlSaudeOverviewDTO;
import com.dashboard.api.dto.etl.EtlTabelaAuditoriaResumoDTO;
import com.dashboard.api.dto.etl.EtlTaxasDiariasPointDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class EtlSaudeSqlRepository {

    private static final DateTimeFormatter ISO_LOCAL_DATE_TIME = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final ZoneId ZONE_ID_APLICACAO = ZoneId.of("America/Sao_Paulo");
    private static final String LOG_STATUS_NORMALIZADO_SQL =
            "COALESCE(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(40), log.status_final)))), N''), N'')";
    private static final String LOG_STATUS_SUCESSO_LISTA_SQL = "N'COMPLETO', N'SUCCESS', N'SUCESSO'";
    private static final String LOG_STATUS_SEM_ERRO_LISTA_SQL = LOG_STATUS_SUCESSO_LISTA_SQL + ", N'ADIADO'";

    private final NamedParameterJdbcOperations jdbcTemplate;
    private final DashboardExportSqlBuilder sqlBuilder;

    public EtlSaudeSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcOperations jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.sqlBuilder = sqlBuilder;
    }

    public EtlSaudeOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        String sql = """
                WITH base_log AS (
                    SELECT
                        log.timestamp_inicio,
                        log.timestamp_fim,
                        CAST(COALESCE(log.registros_extraidos, 0) AS BIGINT)
                            + CAST(COALESCE(log.noop_count, 0) AS BIGINT) AS registros_processados,
                        %s AS status_normalizado
                    FROM dbo.log_extracoes log
                    WHERE log.timestamp_inicio >= :dataInicio
                      AND log.timestamp_inicio < :dataFimExclusivo
                ),
                agregado AS (
                    SELECT
                        MAX(timestamp_fim) AS updated_at,
                        COUNT(CASE WHEN status_normalizado <> N'ADIADO' THEN 1 END) AS total_execucoes,
                        AVG(CAST(CASE
                            WHEN status_normalizado = N'ADIADO' THEN NULL
                            WHEN timestamp_fim >= timestamp_inicio THEN DATEDIFF_BIG(SECOND, timestamp_inicio, timestamp_fim)
                            ELSE 0
                        END AS FLOAT)) AS tempo_medio_execucao_segundos,
                        SUM(CASE WHEN status_normalizado NOT IN (%s) THEN 1 ELSE 0 END) AS execucoes_com_erro,
                        SUM(registros_processados) AS volume_processado_total,
                        SUM(CASE WHEN status_normalizado IN (%s) THEN 1 ELSE 0 END) AS execucoes_sucesso
                    FROM base_log
                )
                SELECT
                    updated_at,
                    CAST(COALESCE(tempo_medio_execucao_segundos, 0) AS DECIMAL(19,2)) AS tempo_medio_execucao_segundos,
                    COALESCE(execucoes_com_erro, 0) AS execucoes_com_erro,
                    total_execucoes,
                    COALESCE(volume_processado_total, 0) AS volume_processado_total,
                    CAST(COALESCE(CAST(execucoes_sucesso AS FLOAT) * 100.0 / NULLIF(total_execucoes, 0), 0) AS DECIMAL(19,2)) AS taxa_sucesso
                FROM agregado
                """.formatted(
                LOG_STATUS_NORMALIZADO_SQL,
                LOG_STATUS_SEM_ERRO_LISTA_SQL,
                LOG_STATUS_SUCESSO_LISTA_SQL
        );

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        return jdbcTemplate.queryForObject(sql, params, (rs, rowNum) -> new EtlSaudeOverviewDTO(
                updatedAt(rs.getTimestamp("updated_at")),
                decimalDouble(rs.getBigDecimal("tempo_medio_execucao_segundos")),
                rs.getInt("execucoes_com_erro"),
                rs.getInt("total_execucoes"),
                rs.getInt("volume_processado_total"),
                decimalDouble(rs.getBigDecimal("taxa_sucesso"))
        ));
    }

    public List<EtlTaxasDiariasPointDTO> buscarSerie(FiltroConsultaDTO filtro) {
        String sql = """
                WITH base_metricas AS (
                    SELECT
                        CAST(log.timestamp_inicio AS DATE) AS data_referencia,
                        %s AS status_normalizado
                    FROM dbo.log_extracoes log
                    WHERE log.timestamp_inicio >= :dataInicio
                      AND log.timestamp_inicio < :dataFimExclusivo
                )
                SELECT
                    data_referencia,
                    SUM(CASE WHEN status_normalizado IN (%s) THEN 1 ELSE 0 END) AS qtd_sucesso,
                    SUM(CASE WHEN status_normalizado NOT IN (%s) THEN 1 ELSE 0 END) AS qtd_falha
                FROM base_metricas
                GROUP BY data_referencia
                ORDER BY data_referencia
                """.formatted(
                LOG_STATUS_NORMALIZADO_SQL,
                LOG_STATUS_SUCESSO_LISTA_SQL,
                LOG_STATUS_SEM_ERRO_LISTA_SQL
        );

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new EtlTaxasDiariasPointDTO(
                rs.getDate("data_referencia").toLocalDate(),
                rs.getInt("qtd_sucesso"),
                rs.getInt("qtd_falha")
        ));
    }

    public List<EtlInsercoesAtualizacoesPointDTO> buscarEvolucaoInsercoesAtualizacoes(FiltroConsultaDTO filtro) {
        String sql = """
                SELECT
                    CAST(log.timestamp_inicio AS DATE) AS data_referencia,
                    SUM(COALESCE(log.registros_extraidos, 0)) AS insercoes,
                    SUM(COALESCE(log.noop_count, 0)) AS atualizacoes
                FROM dbo.log_extracoes log
                WHERE log.timestamp_inicio >= :dataInicio
                  AND log.timestamp_inicio < :dataFimExclusivo
                GROUP BY CAST(log.timestamp_inicio AS DATE)
                ORDER BY data_referencia
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new EtlInsercoesAtualizacoesPointDTO(
                rs.getDate("data_referencia").toLocalDate(),
                rs.getInt("insercoes"),
                rs.getInt("atualizacoes")
        ));
    }

    public List<EtlLogExtracaoAuditoriaDTO> buscarTabela(FiltroConsultaDTO filtro) {
        String sql = """
                SELECT TOP (5000)
                    log.id,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), log.entidade))), N'') AS entidade,
                    log.timestamp_inicio,
                    log.timestamp_fim,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(40), log.status_final))), N'') AS status_final,
                    log.registros_extraidos,
                    log.paginas_processadas,
                    log.noop_count,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), log.mensagem))), N'') AS mensagem
                FROM dbo.log_extracoes log
                WHERE log.timestamp_inicio >= :dataInicio
                  AND log.timestamp_inicio < :dataFimExclusivo
                ORDER BY log.timestamp_fim DESC, log.id DESC
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new EtlLogExtracaoAuditoriaDTO(
                rs.getLong("id"),
                rs.getString("entidade"),
                localDateTime(rs.getTimestamp("timestamp_inicio")),
                localDateTime(rs.getTimestamp("timestamp_fim")),
                rs.getString("status_final"),
                inteiro(rs, "registros_extraidos"),
                inteiro(rs, "paginas_processadas"),
                inteiro(rs, "noop_count"),
                rs.getString("mensagem")
        ));
    }

    public List<EtlTabelaAuditoriaResumoDTO> buscarResumoTabelas(FiltroConsultaDTO filtro) {
        String sql = """
                WITH base_log AS (
                    SELECT
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), log.entidade))), N''), N'Sem entidade') AS target_entity,
                        LOWER(REPLACE(COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), log.entidade))), N''), N'sem_entidade'), N'dbo.', N'')) AS target_key,
                        CAST(COALESCE(log.registros_extraidos, 0) AS BIGINT)
                            + CAST(COALESCE(log.noop_count, 0) AS BIGINT) AS registros_gravados,
                        %s AS status_normalizado,
                        log.timestamp_inicio,
                        log.timestamp_fim
                    FROM dbo.log_extracoes log
                    WHERE log.timestamp_inicio >= :dataInicio
                      AND log.timestamp_inicio < :dataFimExclusivo
                ),
                datas_negocio AS (
                    SELECT
                        N'coletas' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Solicitacao])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Solicitacao])) AS maior_data_negocio
                    FROM dbo.vw_coletas_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'coletas')

                    UNION ALL

                    SELECT
                        N'fretes' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Data frete])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Data frete])) AS maior_data_negocio
                    FROM dbo.vw_fretes_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'fretes')

                    UNION ALL

                    SELECT
                        N'manifestos' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Data criação])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Data criação])) AS maior_data_negocio
                    FROM dbo.vw_manifestos_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'manifestos')

                    UNION ALL

                    SELECT
                        N'cotacoes' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Data Cotação])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Data Cotação])) AS maior_data_negocio
                    FROM dbo.vw_cotacoes_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'cotacoes')

                    UNION ALL

                    SELECT
                        N'localizacao_cargas' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Data do frete])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Data do frete])) AS maior_data_negocio
                    FROM dbo.vw_localizacao_cargas_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'localizacao_cargas')

                    UNION ALL

                    SELECT
                        N'contas_a_pagar' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Emissão])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Emissão])) AS maior_data_negocio
                    FROM dbo.vw_contas_a_pagar_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'contas_a_pagar')

                    UNION ALL

                    SELECT
                        N'faturas_por_cliente' AS target_key,
                        MIN(TRY_CONVERT(DATETIME2, [Fatura/Emissão Fatura])) AS menor_data_negocio,
                        MAX(TRY_CONVERT(DATETIME2, [Fatura/Emissão Fatura])) AS maior_data_negocio
                    FROM dbo.vw_faturas_por_cliente_powerbi
                    WHERE EXISTS (SELECT 1 FROM base_log WHERE target_key = N'faturas_por_cliente')
                )
                SELECT
                    base_log.target_entity,
                    COUNT_BIG(CASE WHEN base_log.status_normalizado <> N'ADIADO' THEN 1 END) AS total_extracoes,
                    SUM(CASE WHEN base_log.status_normalizado IN (%s) THEN 1 ELSE 0 END) AS total_sucessos,
                    SUM(CASE WHEN base_log.status_normalizado NOT IN (%s) THEN 1 ELSE 0 END) AS total_falhas,
                    SUM(base_log.registros_gravados) AS total_registros_gravados,
                    MIN(base_log.timestamp_inicio) AS primeira_extracao,
                    MAX(base_log.timestamp_fim) AS ultima_extracao,
                    MIN(datas_negocio.menor_data_negocio) AS menor_data_negocio,
                    MAX(datas_negocio.maior_data_negocio) AS maior_data_negocio
                FROM base_log
                LEFT JOIN datas_negocio
                       ON datas_negocio.target_key = base_log.target_key
                GROUP BY base_log.target_entity, base_log.target_key
                ORDER BY total_registros_gravados ASC, target_entity
                """.formatted(
                LOG_STATUS_NORMALIZADO_SQL,
                LOG_STATUS_SUCESSO_LISTA_SQL,
                LOG_STATUS_SEM_ERRO_LISTA_SQL
        );

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new EtlTabelaAuditoriaResumoDTO(
                rs.getString("target_entity"),
                rs.getLong("total_extracoes"),
                rs.getLong("total_sucessos"),
                rs.getLong("total_falhas"),
                rs.getLong("total_registros_gravados"),
                localDateTime(rs.getTimestamp("primeira_extracao")),
                localDateTime(rs.getTimestamp("ultima_extracao")),
                localDateTime(rs.getTimestamp("menor_data_negocio")),
                localDateTime(rs.getTimestamp("maior_data_negocio"))
        ));
    }

    public long totalTabela(FiltroConsultaDTO filtro) {
        String sql = """
                SELECT COUNT(1)
                FROM dbo.log_extracoes log
                WHERE log.timestamp_inicio >= :dataInicio
                  AND log.timestamp_inicio < :dataFimExclusivo
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        Long total = jdbcTemplate.queryForObject(sql, params, Long.class);
        return total == null ? 0 : total;
    }

    public EtlSaudeChartsDTO buscarGraficos(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String categoriaSql = "NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Categoria Erro]))), N'')";
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        %s AS categoria
                    FROM base_filtrada
                )
                SELECT
                    categoria,
                    COUNT(1) AS total
                FROM base_metricas
                WHERE categoria IS NOT NULL
                GROUP BY categoria
                ORDER BY total DESC, categoria
                """.formatted(source.sql(), categoriaSql);

        List<EtlCategoriaErroDTO> categoriasErro = jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) ->
                new EtlCategoriaErroDTO(rs.getString("categoria"), rs.getInt("total"))
        );
        return new EtlSaudeChartsDTO(categoriasErro);
    }

    private DashboardExportSqlBuilder.ExportSql source(FiltroConsultaDTO filtro) {
        return sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.ETL_SAUDE,
                filtro,
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );
    }

    private MapSqlParameterSource copiarParams(DashboardExportSqlBuilder.ExportSql source) {
        return new MapSqlParameterSource(source.params().getValues());
    }

    private String updatedAt(Timestamp timestamp) {
        LocalDateTime valor = timestamp != null ? timestamp.toLocalDateTime() : LocalDateTime.now(ZONE_ID_APLICACAO);
        return valor.format(ISO_LOCAL_DATE_TIME);
    }

    private double decimalDouble(BigDecimal valor) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private LocalDateTime localDateTime(Timestamp timestamp) {
        return timestamp != null ? timestamp.toLocalDateTime() : null;
    }

    private Integer inteiro(ResultSet rs, String coluna) throws SQLException {
        int valor = rs.getInt(coluna);
        return rs.wasNull() ? null : valor;
    }
}
