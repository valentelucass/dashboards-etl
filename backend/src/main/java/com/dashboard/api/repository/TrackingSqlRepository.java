package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.tracking.TrackingChartsDTO;
import com.dashboard.api.dto.tracking.TrackingDashboardDTO;
import com.dashboard.api.dto.tracking.TrackingMatrizRegiaoDTO;
import com.dashboard.api.dto.tracking.TrackingOverviewDTO;
import com.dashboard.api.dto.tracking.TrackingPrevisaoVencidaFilialDTO;
import com.dashboard.api.dto.tracking.TrackingStatusDistribuicaoDTO;
import com.dashboard.api.dto.tracking.TrackingTimelinePointDTO;
import com.dashboard.api.dto.tracking.TrackingValorPorRegiaoDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.ConsultaFiltroUtils;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class TrackingSqlRepository {

    private static final Logger log = LoggerFactory.getLogger(TrackingSqlRepository.class);
    private final NamedParameterJdbcOperations jdbcTemplate;
    private final DashboardExportSqlBuilder sqlBuilder;
    private final EscopoFilialService escopoFilialService;
    private final PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper;
    private volatile TrackingViewColumns trackingViewColumns;

    public TrackingSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcOperations jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder,
            EscopoFilialService escopoFilialService,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.sqlBuilder = sqlBuilder;
        this.escopoFilialService = escopoFilialService;
        this.periodoOffsetDateTimeHelper = periodoOffsetDateTimeHelper;
    }

    public TrackingOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        TrackingViewColumns colunas = carregarColunasTracking();
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("hoje", periodoOffsetDateTimeHelper.hoje());

        String statusNormalizadoSql = statusNormalizadoSql(colunas);
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                agregado AS (
                    SELECT
                        MAX(%s) AS updated_at,
                        COUNT(1) AS total_cargas,
                        SUM(CASE
                            WHEN %s IN (N'delivering', N'in_transfer', N'manifested', N'em entrega', N'em transferência', N'em transferencia', N'manifestado')
                            THEN 1 ELSE 0
                        END) AS em_transito,
                        SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS previsao_vencida,
                        SUM(%s) AS valor_frete,
                        SUM(%s) AS peso_taxado,
                        SUM(CASE WHEN %s IN (N'finished', N'delivered', N'finalizado', N'entregue') THEN 1 ELSE 0 END) AS finalizadas,
                        SUM(CASE WHEN %s NOT IN (N'canceled', N'cancelled', N'cancelado') THEN 1 ELSE 0 END) AS elegiveis_finalizacao
                    FROM base_filtrada
                )
                SELECT
                    updated_at,
                    total_cargas,
                    em_transito,
                    previsao_vencida,
                    CAST(COALESCE(valor_frete, 0) AS DECIMAL(19,2)) AS valor_frete,
                    CAST(COALESCE(peso_taxado, 0) AS DECIMAL(19,2)) AS peso_taxado,
                    CAST(COALESCE(CAST(finalizadas AS FLOAT) * 100.0 / NULLIF(elegiveis_finalizacao, 0), 0) AS DECIMAL(19,2)) AS pct_finalizado
                FROM agregado
                """.formatted(
                source.sql(),
                dataExtracaoSql(),
                statusNormalizadoSql,
                previsaoVencidaSql(statusNormalizadoSql),
                valorFreteSql(),
                pesoSql(colunas),
                statusNormalizadoSql,
                statusNormalizadoSql
        );

        return jdbcTemplate.queryForObject(sql, params, (rs, rowNum) -> new TrackingOverviewDTO(
                updatedAt(rs.getTimestamp("updated_at")),
                rs.getInt("total_cargas"),
                rs.getInt("em_transito"),
                rs.getInt("previsao_vencida"),
                decimal(rs.getBigDecimal("valor_frete")),
                decimal(rs.getBigDecimal("peso_taxado")),
                decimal(rs.getBigDecimal("pct_finalizado")).doubleValue()
        ));
    }

    public List<TrackingTimelinePointDTO> buscarSerie(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String statusExibicaoSql = statusExibicaoSql();
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        CAST([Data do frete] AS date) AS data_frete,
                        %s AS status_exibicao
                    FROM base_filtrada
                    WHERE [Data do frete] IS NOT NULL
                )
                SELECT
                    data_frete,
                    SUM(CASE WHEN status_exibicao = N'NO ARMAZÉM' THEN 1 ELSE 0 END) AS pendente,
                    SUM(CASE WHEN LOWER(status_exibicao) = N'em entrega' THEN 1 ELSE 0 END) AS em_entrega,
                    SUM(CASE WHEN LOWER(status_exibicao) IN (N'em transferência', N'em transferencia') THEN 1 ELSE 0 END) AS em_transferencia,
                    0 AS finalizado
                FROM base_metricas
                GROUP BY data_frete
                ORDER BY data_frete
                """.formatted(source.sql(), statusExibicaoSql);

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new TrackingTimelinePointDTO(
                data(rs.getDate("data_frete")),
                rs.getInt("pendente"),
                rs.getInt("em_entrega"),
                rs.getInt("em_transferencia"),
                rs.getInt("finalizado")
        ));
    }

    public TrackingChartsDTO buscarGraficos(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        TrackingViewColumns colunas = carregarColunasTracking();

        return new TrackingChartsDTO(
              buscarStatusDistribuicao(source),
              buscarPrevisaoVencidaPorFilialAtual(source, colunas),
              buscarValorPorRegiaoDestino(source)
        );
    }

    public TrackingDashboardDTO buscarDashboardConsultaUnica(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        TrackingViewColumns colunas = carregarColunasTracking();
        TrackingChartsDTO graficos = new TrackingChartsDTO(
              buscarStatusDistribuicao(source),
                List.of(),
              buscarValorRegiaoDestinoTop10(source, colunas)
        );

        return new TrackingDashboardDTO(
              buscarOverview(filtro),
              buscarMatrizRegiaoDestino(source, colunas),
                graficos
        );
    }

    private List<TrackingMatrizRegiaoDTO> buscarMatrizRegiaoDestino(
            DashboardExportSqlBuilder.ExportSql source,
            TrackingViewColumns colunas
    ) {
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("hoje", periodoOffsetDateTimeHelper.hoje());
        String siglaRegiaoSql = siglaRegiaoDestinoSql(colunas);
        String responsavelRegiaoSql = responsavelRegiaoDestinoSql();
        String statusNormalizadoSql = statusNormalizadoSql(colunas);
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                )
                SELECT
                    %s AS sigla,
                    %s AS responsavel,
                    CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS peso_taxado,
                    CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_frete,
                    CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_nota,
                    SUM(%s) AS volumes,
                    SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS fora_prazo
                FROM base_filtrada
                GROUP BY
                    %s,
                    %s
                ORDER BY peso_taxado DESC, sigla ASC
                """.formatted(
                source.sql(),
                siglaRegiaoSql,
                responsavelRegiaoSql,
                pesoSql(colunas),
                valorFreteSql(),
                valorNfSql(colunas),
                volumesSql(),
                previsaoVencidaSql(statusNormalizadoSql),
                siglaRegiaoSql,
                responsavelRegiaoSql
        );

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new TrackingMatrizRegiaoDTO(
                rs.getString("sigla"),
                rs.getString("responsavel"),
                decimal(rs.getBigDecimal("peso_taxado")),
                decimal(rs.getBigDecimal("valor_frete")),
                decimal(rs.getBigDecimal("valor_nota")),
                rs.getInt("volumes"),
                rs.getInt("fora_prazo")
        ));
    }

    private List<TrackingStatusDistribuicaoDTO> buscarStatusDistribuicao(DashboardExportSqlBuilder.ExportSql source) {
        String statusExibicaoSql = statusExibicaoSql();
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                )
                SELECT
                    %s AS status,
                    COUNT(1) AS total,
                    CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_frete
                FROM base_filtrada
                GROUP BY %s
                ORDER BY total DESC, status ASC
                """.formatted(source.sql(), statusExibicaoSql, valorFreteSql(), statusExibicaoSql);

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new TrackingStatusDistribuicaoDTO(
                rs.getString("status"),
                rs.getInt("total"),
                decimal(rs.getBigDecimal("valor_frete"))
        ));
    }

    private List<TrackingPrevisaoVencidaFilialDTO> buscarPrevisaoVencidaPorFilialAtual(
            DashboardExportSqlBuilder.ExportSql source,
            TrackingViewColumns colunas
    ) {
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("hoje", periodoOffsetDateTimeHelper.hoje());
        String statusNormalizadoSql = statusNormalizadoSql(colunas);
        String filialAtualSql = filialAtualSql();
        String previsaoVencidaSql = previsaoVencidaSql(statusNormalizadoSql);
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                )
                SELECT
                    %s AS filial_atual,
                    COUNT(1) AS vencidas,
                    COUNT(1) AS total
                FROM base_filtrada
                WHERE %s
                GROUP BY %s
                ORDER BY vencidas DESC, filial_atual
                """.formatted(source.sql(), filialAtualSql, previsaoVencidaSql, filialAtualSql);

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new TrackingPrevisaoVencidaFilialDTO(
                rs.getString("filial_atual"),
                rs.getInt("vencidas"),
                rs.getInt("total")
        ));
    }

    private List<TrackingValorPorRegiaoDTO> buscarValorPorRegiaoDestino(DashboardExportSqlBuilder.ExportSql source) {
        String regiaoSql = regiaoDestinoSql();
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                )
                SELECT
                    %s AS regiao_destino,
                    CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_frete,
                    COUNT(1) AS cargas
                FROM base_filtrada
                GROUP BY %s
                ORDER BY valor_frete DESC, regiao_destino
                """.formatted(source.sql(), regiaoSql, valorFreteSql(), regiaoSql);

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new TrackingValorPorRegiaoDTO(
                rs.getString("regiao_destino"),
                decimal(rs.getBigDecimal("valor_frete")),
                rs.getInt("cargas")
        ));
    }

    private List<TrackingValorPorRegiaoDTO> buscarValorRegiaoDestinoTop10(
            DashboardExportSqlBuilder.ExportSql source,
            TrackingViewColumns colunas
    ) {
        String siglaRegiaoSql = siglaRegiaoDestinoSql(colunas);
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                regioes AS (
                    SELECT
                        %s AS regiao,
                        SUM(%s) AS valor_frete,
                        COUNT(1) AS cargas,
                        ROW_NUMBER() OVER (ORDER BY SUM(%s) DESC, %s ASC) AS rn
                    FROM base_filtrada
                    GROUP BY %s
                )
                SELECT
                    CASE WHEN rn <= 10 THEN regiao ELSE N'Outros' END AS regiao_destino,
                    CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS valor_frete,
                    SUM(cargas) AS cargas,
                    MIN(CASE WHEN rn <= 10 THEN rn ELSE 999 END) AS ordem
                FROM regioes
                GROUP BY CASE WHEN rn <= 10 THEN regiao ELSE N'Outros' END
                ORDER BY ordem ASC, valor_frete DESC
                """.formatted(source.sql(), siglaRegiaoSql, valorFreteSql(), valorFreteSql(), siglaRegiaoSql, siglaRegiaoSql);

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new TrackingValorPorRegiaoDTO(
                rs.getString("regiao_destino"),
                decimal(rs.getBigDecimal("valor_frete")),
                rs.getInt("cargas")
        ));
    }

    private DashboardExportSqlBuilder.ExportSql source(FiltroConsultaDTO filtro) {
        return sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.TRACKING,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );
    }

    private TrackingViewColumns carregarColunasTracking() {
        TrackingViewColumns cached = trackingViewColumns;
        if (cached != null) {
            return cached;
        }

        List<String> nomes = jdbcTemplate.queryForList("""
                SELECT name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) * FROM dbo.vw_localizacao_cargas_powerbi',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND is_hidden = 0
                ORDER BY column_ordinal
                """, new MapSqlParameterSource(), String.class);

        Set<String> colunas = nomes.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        TrackingViewColumns carregadas = new TrackingViewColumns(
                colunas.contains("Status Normalizado"),
                colunas.contains("Peso Taxado Decimal"),
                colunas.contains("Valor NF Decimal"),
                colunas.contains("Sigla Responsável Região Destino")
        );

        if (!carregadas.contratoGovernadoCompleto()) {
            log.warn(
                    "View de localização de cargas sem contrato governado completo; usando fallback compatível. colunas={}",
                    carregadas
            );
        }

        trackingViewColumns = carregadas;
        return carregadas;
    }

    private String statusExibicaoSql() {
        return """
                CASE
                    WHEN [Status Carga] IS NULL
                      OR LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status Carga])))) IN (N'pending', N'pendente', N'sem_status', N'sem status')
                    THEN N'NO ARMAZÉM'
                    ELSE LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status Carga])))
                END
                """;
    }

    private String statusNormalizadoSql(TrackingViewColumns colunas) {
        if (colunas.statusNormalizado()) {
            return """
                    COALESCE(
                        NULLIF(LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status Normalizado])))), N''),
                        NULLIF(LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status Carga])))), N''),
                        N'sem_status'
                    )
                    """;
        }

        return """
                COALESCE(
                    NULLIF(LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status Carga])))), N''),
                    N'sem_status'
                )
                """;
    }

    private String previsaoVencidaSql(String statusNormalizadoSql) {
        return """
                (
                    [Previsão Entrega/Previsão de entrega] IS NOT NULL
                    AND [Previsão Entrega/Previsão de entrega] < :hoje
                    AND %s NOT IN (N'finished', N'delivered', N'canceled', N'cancelled', N'finalizado', N'entregue', N'cancelado')
                )
                """.formatted(statusNormalizadoSql);
    }

    private String pesoSql(TrackingViewColumns colunas) {
        return """
                COALESCE(
                    %s
                    TRY_CONVERT(DECIMAL(18, 3), [Peso Taxado]),
                    TRY_CONVERT(DECIMAL(18, 3), REPLACE(CONVERT(NVARCHAR(50), [Peso Taxado]), N',', N'.')),
                    TRY_CONVERT(DECIMAL(18, 3), REPLACE(REPLACE(CONVERT(NVARCHAR(50), [Peso Taxado]), N'.', N''), N',', N'.')),
                    0
                )
                """.formatted(colunas.pesoTaxadoDecimal()
                ? "TRY_CONVERT(DECIMAL(18, 3), [Peso Taxado Decimal]),\n        "
                : "");
    }

    private String valorNfSql(TrackingViewColumns colunas) {
        return """
                COALESCE(
                    %s
                    TRY_CONVERT(DECIMAL(18, 2), [Valor NF]),
                    TRY_CONVERT(DECIMAL(18, 2), REPLACE(CONVERT(NVARCHAR(50), [Valor NF]), N',', N'.')),
                    TRY_CONVERT(DECIMAL(18, 2), REPLACE(REPLACE(CONVERT(NVARCHAR(50), [Valor NF]), N'.', N''), N',', N'.')),
                    0
                )
                """.formatted(colunas.valorNfDecimal()
                ? "TRY_CONVERT(DECIMAL(18, 2), [Valor NF Decimal]),\n        "
                : "");
    }

    private String dataExtracaoSql() {
        return """
                COALESCE(
                    TRY_CONVERT(DATETIME2, [Data de extracao]),
                    TRY_CONVERT(DATETIME2, CONVERT(NVARCHAR(50), [Data de extracao]), 126),
                    TRY_CONVERT(DATETIME2, CONVERT(NVARCHAR(50), [Data de extracao]), 120),
                    TRY_CONVERT(DATETIME2, CONVERT(NVARCHAR(50), [Data de extracao]), 103)
                )
                """;
    }

    private String valorFreteSql() {
        return """
                COALESCE(
                    TRY_CONVERT(DECIMAL(18, 2), [Valor Frete]),
                    TRY_CONVERT(DECIMAL(18, 2), REPLACE(CONVERT(NVARCHAR(50), [Valor Frete]), N',', N'.')),
                    TRY_CONVERT(DECIMAL(18, 2), REPLACE(REPLACE(CONVERT(NVARCHAR(50), [Valor Frete]), N'.', N''), N',', N'.')),
                    0
                )
                """;
    }

    private String volumesSql() {
        return """
                COALESCE(
                    TRY_CONVERT(INT, [Volumes]),
                    TRY_CONVERT(INT, TRY_CONVERT(DECIMAL(18, 3), [Volumes])),
                    TRY_CONVERT(INT, TRY_CONVERT(DECIMAL(18, 3), REPLACE(CONVERT(NVARCHAR(50), [Volumes]), N',', N'.'))),
                    0
                )
                """;
    }

    private String siglaRegiaoDestinoSql(TrackingViewColumns colunas) {
        if (colunas.siglaResponsavelRegiaoDestino()) {
            return """
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Sigla Responsável Região Destino]))), N''),
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Responsável pela Região de Destino]))), N''),
                        N'SEM_MAP'
                    )
                    """;
        }

        return """
                COALESCE(
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Responsável pela Região de Destino]))), N''),
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Região Destino]))), N''),
                    N'SEM_MAP'
                )
                """;
    }

    private String responsavelRegiaoDestinoSql() {
        return """
                COALESCE(
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Responsável pela Região de Destino]))), N''),
                    N'Sem responsável'
                )
                """;
    }

    private String filialAtualSql() {
        return """
                COALESCE(
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Filial Atual]))), N''),
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Filial Emissora]))), N''),
                    N'Sem filial'
                )
                """;
    }

    private String regiaoDestinoSql() {
        return "COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Região Destino]))), N''), N'Sem regiao')";
    }

    private MapSqlParameterSource copiarParams(DashboardExportSqlBuilder.ExportSql source) {
        return new MapSqlParameterSource(source.params().getValues());
    }

    private String updatedAt(Timestamp timestamp) {
        LocalDateTime valor = timestamp != null ? timestamp.toLocalDateTime() : null;
        return TemporalJsonUtils.formatarIsoComOffset(valor);
    }

    private BigDecimal decimal(BigDecimal valor) {
        return ConsultaFiltroUtils.zeroSeNulo(valor).setScale(2, RoundingMode.HALF_UP);
    }

    private String data(Date data) {
        return data != null ? data.toLocalDate().toString() : null;
    }

    private record TrackingViewColumns(
            boolean statusNormalizado,
            boolean pesoTaxadoDecimal,
            boolean valorNfDecimal,
            boolean siglaResponsavelRegiaoDestino
    ) {
        private boolean contratoGovernadoCompleto() {
            return statusNormalizado
                    && pesoTaxadoDecimal
                    && valorNfDecimal
                    && siglaResponsavelRegiaoDestino;
        }
    }
}
