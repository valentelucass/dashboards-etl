package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.dto.tracking.TrackingFreteDTO;
import com.dashboard.api.dto.tracking.TrackingRegiaoDTO;
import com.dashboard.api.util.ConsultaLimiteUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;
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
import java.time.LocalDate;
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

    private static final ObjectReader NUMEROS_NF = new ObjectMapper().readerForListOf(String.class);
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
                            WHEN [Status Carga] IN (N'Em Entrega', N'Em Transferência', N'Manifestada')
                            THEN 1 ELSE 0
                        END) AS em_transito,
                        SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS previsao_vencida,
                        SUM(CASE WHEN [Status Terminal] = 0 THEN %s ELSE 0 END) AS valor_frete,
                        SUM(%s) AS peso_taxado,
                        SUM([Status Terminal]) AS finalizadas
                    FROM base_filtrada
                )
                SELECT
                    updated_at,
                    total_cargas,
                    em_transito,
                    previsao_vencida,
                    CAST(COALESCE(valor_frete, 0) AS DECIMAL(19,2)) AS valor_frete,
                    CAST(COALESCE(peso_taxado, 0) AS DECIMAL(19,2)) AS peso_taxado,
                    CAST(COALESCE(CAST(finalizadas AS FLOAT) * 100.0 / NULLIF(total_cargas, 0), 0) AS DECIMAL(19,2)) AS pct_finalizado
                FROM agregado
                """.formatted(
                source.sql(),
                dataExtracaoSql(),
                previsaoVencidaSql(),
                valorFreteSql(),
                pesoSql(colunas)
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
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        CAST([Data do frete] AS date) AS data_frete,
                        [Status Carga] AS status_exibicao
                    FROM base_filtrada
                    WHERE [Data do frete] IS NOT NULL
                )
                SELECT
                    data_frete,
                    SUM(CASE WHEN status_exibicao = N'No Armazém' THEN 1 ELSE 0 END) AS pendente,
                    SUM(CASE WHEN status_exibicao = N'Em Entrega' THEN 1 ELSE 0 END) AS em_entrega,
                    SUM(CASE WHEN status_exibicao = N'Em Transferência' THEN 1 ELSE 0 END) AS em_transferencia,
                    SUM(CASE WHEN status_exibicao = N'Finalizadas' THEN 1 ELSE 0 END) AS finalizado,
                    SUM(CASE WHEN status_exibicao = N'Manifestada' THEN 1 ELSE 0 END) AS manifestada
                FROM base_metricas
                GROUP BY data_frete
                ORDER BY data_frete
                """.formatted(source.sql());

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new TrackingTimelinePointDTO(
                data(rs.getDate("data_frete")),
                rs.getInt("pendente"),
                rs.getInt("em_entrega"),
                rs.getInt("em_transferencia"),
                rs.getInt("finalizado"),
                rs.getInt("manifestada")
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
              buscarValorRegiaoDestinoTop10(source)
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
        String sql = """
                SELECT [Sigla Responsável Região Destino] AS sigla,
                       CASE WHEN MIN([Responsável pela Região de Destino]) = MAX([Responsável pela Região de Destino])
                            THEN MIN([Responsável pela Região de Destino]) END AS responsavel,
                       %s
                %s
                GROUP BY [Sigla Responsável Região Destino]
                ORDER BY peso_taxado DESC, sigla ASC
                """.formatted(metricasMatriz(colunas), source.sql());

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new TrackingMatrizRegiaoDTO(
                rs.getString("sigla"),
                rs.getString("responsavel"),
                decimal(rs.getBigDecimal("peso_taxado")),
                decimal(rs.getBigDecimal("valor_frete")),
                decimal(rs.getBigDecimal("valor_nota")),
                rs.getInt("volumes"),
                rs.getInt("fora_prazo"),
                rs.getInt("total_cargas")
        ));
    }

    private String metricasMatriz(TrackingViewColumns colunas) {
        return """
                CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS peso_taxado,
                CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_frete,
                CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_nota,
                SUM(%s) AS volumes,
                SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS fora_prazo,
                COUNT(1) AS total_cargas
                """.formatted(pesoSql(colunas), valorFreteSql(), valorNfSql(colunas), volumesSql(), previsaoVencidaSql());
    }

    public PaginaDTO<TrackingRegiaoDTO> buscarRegioes(FiltroConsultaDTO filtro, int pagina, int tamanho) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String count = "SELECT COUNT(DISTINCT [Região Destino]) " + source.sql();
        String sql = """
                SELECT [Região Destino], %s
                %s
                GROUP BY [Região Destino]
                ORDER BY peso_taxado DESC, [Região Destino]
                """.formatted(metricasMatriz(carregarColunasTracking()), source.sql());
        return pagina(count, sql, source, pagina, tamanho, (rs, rowNum) -> new TrackingRegiaoDTO(
                rs.getString("Região Destino"), rs.getBigDecimal("peso_taxado"), rs.getBigDecimal("valor_frete"),
                rs.getBigDecimal("valor_nota"), rs.getInt("volumes"), rs.getInt("fora_prazo"), rs.getInt("total_cargas")
        ));
    }

    public PaginaDTO<TrackingFreteDTO> buscarFretes(FiltroConsultaDTO filtro, int pagina, int tamanho) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        TrackingViewColumns colunas = carregarColunasTracking();
        String sql = """
                SELECT [N° Minuta], [Status Carga], %s AS volumes, %s AS peso_taxado,
                       %s AS valor_frete, %s AS valor_nota,
                       CAST([Previsão Entrega/Previsão de entrega] AS date) AS previsao_entrega,
                       CASE WHEN %s THEN 1 ELSE 0 END AS atrasado,
                       JSON_QUERY([Metadata], '$.invoices_mapping') AS notas
                %s
                ORDER BY [Data do frete] DESC, [N° Minuta] DESC, [Hash Localização]
                """.formatted(volumesSql(), pesoSql(colunas), valorFreteSql(), valorNfSql(colunas), previsaoVencidaSql(), source.sql());
        return pagina("SELECT COUNT_BIG(1) " + source.sql(), sql, source, pagina, tamanho, (rs, rowNum) -> new TrackingFreteDTO(
                rs.getObject("N° Minuta", Long.class), numerosNf(rs.getString("notas")), rs.getString("Status Carga"),
                rs.getObject("previsao_entrega", LocalDate.class), rs.getBoolean("atrasado"),
                rs.getInt("volumes"), rs.getBigDecimal("peso_taxado"), rs.getBigDecimal("valor_frete"), rs.getBigDecimal("valor_nota")
        ));
    }

    private static List<String> numerosNf(String json) throws SQLException {
        if (json == null) {
            return List.of();
        }
        try {
            return NUMEROS_NF.readValue(json);
        } catch (JsonProcessingException e) {
            throw new SQLException("Lista de notas fiscais inválida no relatório de localização.", e);
        }
    }

    private <T> PaginaDTO<T> pagina(String count, String sql, DashboardExportSqlBuilder.ExportSql source,
                                   int paginaSolicitada, int tamanhoSolicitado, RowMapper<T> mapper) {
        int pagina = Math.max(1, paginaSolicitada);
        int tamanho = ConsultaLimiteUtils.limitar(tamanhoSolicitado, 10, 100);
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("hoje", periodoOffsetDateTimeHelper.hoje());
        params.addValue("offset", (long) (pagina - 1) * tamanho);
        params.addValue("tamanho", tamanho);
        Long total = jdbcTemplate.queryForObject(count, params, Long.class);
        List<T> linhas = jdbcTemplate.query(sql + " OFFSET :offset ROWS FETCH NEXT :tamanho ROWS ONLY", params, mapper);
        long totalLinhas = total == null ? 0 : total;
        return new PaginaDTO<>(linhas, totalLinhas, (int) Math.ceil(totalLinhas / (double) tamanho), pagina, tamanho);
    }

    private List<TrackingStatusDistribuicaoDTO> buscarStatusDistribuicao(DashboardExportSqlBuilder.ExportSql source) {
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                )
                SELECT
                    [Status Carga] AS status,
                    COUNT(1) AS total,
                    CAST(COALESCE(SUM(%s), 0) AS DECIMAL(19,2)) AS valor_frete
                FROM base_filtrada
                GROUP BY [Status Carga]
                ORDER BY total DESC, status ASC
                """.formatted(source.sql(), valorFreteSql());

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
        String filialAtualSql = filialAtualSql();
        String previsaoVencidaSql = previsaoVencidaSql();
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
            DashboardExportSqlBuilder.ExportSql source
    ) {
        String siglaRegiaoSql = "[Sigla Responsável Região Destino]";
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
                colunas.contains("Peso Taxado Decimal"),
                colunas.contains("Valor NF Decimal")
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

    private String previsaoVencidaSql() {
        return "CAST([Previsão Entrega/Previsão de entrega] AS date) < :hoje AND [Status Terminal] = 0";
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
            boolean pesoTaxadoDecimal,
            boolean valorNfDecimal
    ) {
        private boolean contratoGovernadoCompleto() {
            return pesoTaxadoDecimal && valorNfDecimal;
        }
    }
}
