package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.indicadoresgestao.CubagemMercadoriasRowDTO;
import com.dashboard.api.dto.indicadoresgestao.CubagemMercadoriasSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.IndenizacaoMercadoriasRowDTO;
import com.dashboard.api.dto.indicadoresgestao.IndenizacaoMercadoriasSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.NivelVisaoPerformance;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaRowDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.UtilizacaoColetoresRowDTO;
import com.dashboard.api.dto.indicadoresgestao.UtilizacaoColetoresSeriePointDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.JanelaOffsetDateTime;
import com.dashboard.api.util.PerformanceMetricasUtils;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class IndicadoresGestaoAVistaSqlRepository {

    private static final String STATUS_CANCELADO = "cancelado";
    private static final String PERFORMANCE_EM_ABERTO = "EM ABERTO";
    private static final int PERFORMANCE_DRILLDOWN_LIMITE = 50;
    private static final BigDecimal VALOR_MINIMO_OPERACIONAL = new BigDecimal("0.01");
    private static final List<String> DOCUMENTOS_FILIAIS_OPERACIONAIS = List.of(
            "51863654000180",
            "51863654000260",
            "60960473000162",
            "60960473000243",
            "60960473000596",
            "60960473000677",
            "60960473000758",
            "60960473000839",
            "60960473001134",
            "60960473001304",
            "60960473001568"
    );
    private static final String[] FILIAIS_COLETORES_PADRAO = {
            "AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CAS - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CPQ - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CWB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "NHB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "REC - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "RJR - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "SPO - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"
    };

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper;

    private final PerformanceDashboardSqlRepository performanceRepository;

    public IndicadoresGestaoAVistaSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper,
            PerformanceDashboardSqlRepository performanceRepository
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.performanceRepository = performanceRepository;
        this.periodoOffsetDateTimeHelper = periodoOffsetDateTimeHelper;
    }

    public PerformanceEntregaResumo buscarPerformanceEntregaResumo(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        var ctx = performanceRepository.entregasDaGestao(filtro, escopo);
        String sql = ctx.sql() + """
                SELECT
                    CONVERT(NVARCHAR(30), MAX(data_extracao), 126) AS updated_at,
                    COUNT_BIG(1) AS total_entregas,
                    COALESCE(SUM(is_finalizada), 0) AS finalizadas,
                    COALESCE(SUM(CAST(is_no_prazo AS BIGINT)), 0) AS entregas_no_prazo,
                    COALESCE(SUM(CAST(is_fora_prazo AS BIGINT)), 0) AS entregas_fora_do_prazo
                FROM performance
                """;

        return resumoPerformance(jdbcTemplate.queryForMap(sql, ctx.params()));
    }

    public List<PerformanceEntregaSeriePointDTO> buscarPerformanceEntregaSerie(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        return buscarPerformanceEntregaSerie(filtro, escopo, NivelVisaoPerformance.RESPONSAVEL, null, null);
    }

    public List<PerformanceEntregaSeriePointDTO> buscarPerformanceEntregaSerie(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            NivelVisaoPerformance visao,
            String responsavelFiltro,
            String regiaoFiltro
    ) {
        var ctx = performanceRepository.entregasDaGestao(filtro, escopo);
        PerformanceVisaoSql visaoSql = performanceVisaoSql(visao);
        String filtrosDrilldown = filtrosPerformanceDrilldown(ctx.params(), visao, responsavelFiltro, regiaoFiltro);
        ctx.params().addValue("limitePerformanceDrilldown", PERFORMANCE_DRILLDOWN_LIMITE);

        String sql = ctx.sql() + """
                SELECT
                    %s AS label,
                    %s AS filtro,
                    COUNT_BIG(1) AS total_entregas,
                    COALESCE(SUM(is_finalizada), 0) AS finalizadas,
                    COALESCE(SUM(CAST(is_no_prazo AS BIGINT)), 0) AS entregas_no_prazo,
                    COALESCE(SUM(CAST(is_fora_prazo AS BIGINT)), 0) AS entregas_fora_do_prazo,
                    CAST(COALESCE(SUM(CAST(is_no_prazo AS FLOAT)) * 100.0 / NULLIF(SUM(is_finalizada), 0), 0) AS DECIMAL(19,2)) AS pct_no_prazo
                FROM performance
                WHERE 1 = 1
                """.formatted(visaoSql.labelSql(), visaoSql.filtroSql()) + filtrosDrilldown + """
                GROUP BY %s
                ORDER BY pct_no_prazo ASC, total_entregas DESC, label
                OFFSET 0 ROWS FETCH NEXT :limitePerformanceDrilldown ROWS ONLY
                """.formatted(visaoSql.groupBySql());

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> {
            long total = rs.getLong("total_entregas");
            long noPrazo = rs.getLong("entregas_no_prazo");
            return new PerformanceEntregaSeriePointDTO(
                    rs.getString("label"),
                    rs.getString("filtro"),
                    visao,
                    inteiro(total),
                    inteiro(rs.getLong("finalizadas")),
                    inteiro(noPrazo),
                    inteiro(rs.getLong("entregas_fora_do_prazo")),
                    PerformanceMetricasUtils.percentual(noPrazo, rs.getLong("finalizadas"))
            );
        });
    }

    public List<PerformanceEntregaRowDTO> buscarPerformanceEntregaLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            int offset,
            int limite
    ) {
        var ctx = performanceRepository.entregasDaGestao(filtro, escopo);
        ctx.params()
                .addValue("offsetLinhas", Math.max(0, offset))
                .addValue("limiteLinhas", Math.max(1, limite));
        String sql = ctx.sql() + performanceEntregaLinhasSql("""
                OFFSET :offsetLinhas ROWS FETCH NEXT :limiteLinhas ROWS ONLY
                """);

        return jdbcTemplate.query(sql, ctx.params(), this::mapearPerformanceEntregaLinha);
    }

    public List<PerformanceEntregaRowDTO> buscarPerformanceEntregaExportacao(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        var ctx = performanceRepository.entregasDaGestao(filtro, escopo);
        return jdbcTemplate.query(ctx.sql() + performanceEntregaLinhasSql(""), ctx.params(), this::mapearPerformanceEntregaLinha);
    }

    public long contarPerformanceEntregaLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        var ctx = performanceRepository.entregasDaGestao(filtro, escopo);
        return count(ctx.sql() + "SELECT COUNT_BIG(1) FROM performance", ctx.params());
    }

    public CubagemResumo buscarCubagemResumo(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoLocalDate(filtro, escopo, false);
        String sql = cubagemCte() + """
                SELECT
                    CONVERT(NVARCHAR(30), MAX(data_extracao), 126) AS updated_at,
                    COUNT_BIG(1) AS total_fretes,
                    COALESCE(SUM(CAST(is_cubado AS BIGINT)), 0) AS fretes_cubados,
                    COALESCE(SUM(CAST(is_peso_real_informado AS BIGINT)), 0) AS fretes_com_peso_real
                FROM cubagem
                """;

        return resumoCubagem(jdbcTemplate.queryForMap(sql, ctx.params()));
    }

    public List<CubagemMercadoriasSeriePointDTO> buscarCubagemSerie(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoLocalDate(filtro, escopo, false);
        String sql = cubagemCte() + """
                SELECT
                    CONVERT(char(10), data_frete_date, 23) AS date,
                    filial,
                    COUNT_BIG(1) AS total_fretes,
                    COALESCE(SUM(CAST(is_cubado AS BIGINT)), 0) AS fretes_cubados
                FROM cubagem
                GROUP BY data_frete_date, filial
                ORDER BY data_frete_date, filial
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> {
            long total = rs.getLong("total_fretes");
            long cubados = rs.getLong("fretes_cubados");
            return new CubagemMercadoriasSeriePointDTO(
                    rs.getString("date"),
                    rs.getString("filial"),
                    inteiro(total),
                    inteiro(cubados),
                    percentual(cubados, total)
            );
        });
    }

    public List<CubagemMercadoriasRowDTO> buscarCubagemLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            int offset,
            int limite
    ) {
        QueryContext ctx = contextoLocalDate(filtro, escopo, false);
        ctx.params()
                .addValue("offsetLinhas", Math.max(0, offset))
                .addValue("limiteLinhas", Math.max(1, limite));
        String sql = cubagemLinhasSql("""
                OFFSET :offsetLinhas ROWS FETCH NEXT :limiteLinhas ROWS ONLY
                """);

        return jdbcTemplate.query(sql, ctx.params(), this::mapearCubagemLinha);
    }

    public List<CubagemMercadoriasRowDTO> buscarCubagemExportacao(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoLocalDate(filtro, escopo, false);
        return jdbcTemplate.query(cubagemLinhasSql(""), ctx.params(), this::mapearCubagemLinha);
    }

    public long contarCubagemLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoLocalDate(filtro, escopo, false);
        return count(cubagemCte() + "SELECT COUNT_BIG(1) FROM cubagem", ctx.params());
    }

    public IndenizacaoResumo buscarIndenizacaoResumo(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoIndenizacao(filtro, escopo);
        String sql = indenizacaoCte() + """
                SELECT
                    CONVERT(NVARCHAR(30), COALESCE((
                        SELECT MAX(valor)
                        FROM (VALUES
                            (MAX(s.data_extracao)),
                            ((SELECT MAX(updated_at) FROM faturamento_periodo))
                        ) atualizacoes(valor)
                    ), SYSDATETIME()), 126) AS updated_at,
                    COUNT_BIG(1) AS total_sinistros,
                    COALESCE(SUM(s.valor_a_pagar_cliente), 0) AS valor_indenizado_original,
                    COALESCE(SUM(ABS(s.valor_a_pagar_cliente)), 0) AS valor_indenizado_abs,
                    COALESCE((SELECT SUM(faturamento) FROM faturamento_periodo), 0) AS faturamento_base
                FROM sinistros s
                """;

        return resumoIndenizacao(jdbcTemplate.queryForMap(sql, ctx.params()));
    }

    public List<IndenizacaoMercadoriasSeriePointDTO> buscarIndenizacaoSerie(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoIndenizacao(filtro, escopo);
        String sql = indenizacaoCte() + """
                , sinistros_mensais AS (
                    SELECT
                        DATEFROMPARTS(YEAR(data_abertura), MONTH(data_abertura), 1) AS mes_ref,
                        filial,
                        COUNT_BIG(1) AS total_sinistros,
                        COALESCE(SUM(valor_a_pagar_cliente), 0) AS valor_indenizado_original,
                        COALESCE(SUM(ABS(valor_a_pagar_cliente)), 0) AS valor_indenizado_abs
                    FROM sinistros
                    GROUP BY DATEFROMPARTS(YEAR(data_abertura), MONTH(data_abertura), 1), filial
                )
                SELECT
                    CONVERT(char(10), sm.mes_ref, 23) AS date,
                    sm.filial,
                    sm.total_sinistros,
                    sm.valor_indenizado_original,
                    sm.valor_indenizado_abs,
                    COALESCE(fm.faturamento, 0) AS faturamento_base,
                    COALESCE(fp.faturamento, 0) AS faturamento_periodo_filial
                FROM sinistros_mensais sm
                LEFT JOIN faturamento_mensal fm
                  ON fm.mes_ref = sm.mes_ref
                 AND fm.filial = sm.filial
                LEFT JOIN faturamento_periodo fp
                  ON fp.filial = sm.filial
                ORDER BY sm.mes_ref, sm.filial
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> {
            BigDecimal valorAbs = decimal(rs, "valor_indenizado_abs");
            BigDecimal faturamentoBase = decimal(rs, "faturamento_base");
            return new IndenizacaoMercadoriasSeriePointDTO(
                    rs.getString("date"),
                    rs.getString("filial"),
                    inteiro(rs.getLong("total_sinistros")),
                    escala(decimal(rs, "valor_indenizado_original"), 2),
                    escala(valorAbs, 2),
                    escala(faturamentoBase, 2),
                    escala(decimal(rs, "faturamento_periodo_filial"), 2),
                    percentual(valorAbs, faturamentoBase)
            );
        });
    }

    public List<IndenizacaoMercadoriasRowDTO> buscarIndenizacaoLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            int offset,
            int limite
    ) {
        QueryContext ctx = contextoIndenizacao(filtro, escopo);
        ctx.params()
                .addValue("offsetLinhas", Math.max(0, offset))
                .addValue("limiteLinhas", Math.max(1, limite));
        String sql = indenizacaoLinhasSql("""
                OFFSET :offsetLinhas ROWS FETCH NEXT :limiteLinhas ROWS ONLY
                """);

        return jdbcTemplate.query(sql, ctx.params(), this::mapearIndenizacaoLinha);
    }

    public List<IndenizacaoMercadoriasRowDTO> buscarIndenizacaoExportacao(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoIndenizacao(filtro, escopo);
        return jdbcTemplate.query(indenizacaoLinhasSql(""), ctx.params(), this::mapearIndenizacaoLinha);
    }

    public long contarIndenizacaoLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoIndenizacao(filtro, escopo);
        return count(indenizacaoCte() + "SELECT COUNT_BIG(1) FROM sinistros", ctx.params());
    }

    public UtilizacaoColetoresResumo buscarUtilizacaoColetoresResumo(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoColetores(filtro, escopo);
        String sql = coletoresFatoCte() + """
                , totais AS (
                    SELECT
                        MAX(updated_at) AS updated_at,
                        COALESCE(SUM(manifestos_bipados), 0) AS manifestos_bipados,
                        COALESCE(SUM(manifestos_emitidos), 0) AS manifestos_emitidos,
                        COALESCE(SUM(manifestos_descarregamento), 0) AS manifestos_descarregamento,
                        COALESCE(SUM(total_manifestos), 0) AS total_manifestos,
                        COALESCE(SUM(manifestos_incompletos), 0) AS manifestos_incompletos
                    FROM coletores_base
                )
                SELECT
                    CONVERT(NVARCHAR(30), updated_at, 126) AS updated_at,
                    manifestos_bipados,
                    manifestos_emitidos,
                    manifestos_descarregamento,
                    total_manifestos,
                    manifestos_incompletos,
                    CAST(CASE
                        WHEN total_manifestos > 0
                            THEN ROUND(
                                (CONVERT(DECIMAL(19, 4), manifestos_bipados) * CONVERT(DECIMAL(19, 4), 100.0))
                                / CONVERT(DECIMAL(19, 4), total_manifestos),
                                1
                            )
                        ELSE 0
                    END AS DECIMAL(9, 1)) AS pct_utilizacao
                FROM totais
                """;

        return resumoColetores(jdbcTemplate.queryForMap(sql, ctx.params()));
    }

    public List<UtilizacaoColetoresSeriePointDTO> buscarUtilizacaoColetoresSerie(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoColetores(filtro, escopo);
        String sql = coletoresAgregadosCte() + """
                SELECT
                    CONVERT(char(10), data_referencia, 23) AS date,
                    filial,
                    classificacao,
                    manifestos_bipados,
                    manifestos_emitidos,
                    manifestos_descarregamento,
                    total_manifestos,
                    manifestos_incompletos,
                    pct_utilizacao
                FROM coletores_agregados
                ORDER BY data_referencia, filial, classificacao
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new UtilizacaoColetoresSeriePointDTO(
                    rs.getString("date"),
                    rs.getString("filial"),
                    rs.getString("classificacao"),
                    inteiro(rs.getLong("manifestos_bipados")),
                    inteiro(rs.getLong("manifestos_emitidos")),
                    inteiro(rs.getLong("manifestos_descarregamento")),
                    inteiro(rs.getLong("total_manifestos")),
                    inteiro(rs.getLong("manifestos_incompletos")),
                    rs.getDouble("pct_utilizacao")
        ));
    }

    public List<UtilizacaoColetoresRankingBase> buscarUtilizacaoColetoresRanking(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoColetores(filtro, escopo);
        String sql = coletoresFatoCte() + """
                SELECT
                    filial,
                    COALESCE(SUM(manifestos_bipados), 0) AS manifestos_bipados,
                    COALESCE(SUM(manifestos_emitidos), 0) AS manifestos_emitidos,
                    COALESCE(SUM(manifestos_descarregamento), 0) AS manifestos_descarregamento,
                    COALESCE(SUM(total_manifestos), 0) AS total_manifestos,
                    COALESCE(SUM(manifestos_incompletos), 0) AS manifestos_incompletos,
                    CAST(CASE
                        WHEN COALESCE(SUM(total_manifestos), 0) > 0
                            THEN ROUND(
                                (CONVERT(DECIMAL(19, 4), COALESCE(SUM(manifestos_bipados), 0)) * CONVERT(DECIMAL(19, 4), 100.0))
                                / CONVERT(DECIMAL(19, 4), COALESCE(SUM(total_manifestos), 0)),
                                1
                            )
                        ELSE 0
                    END AS DECIMAL(9, 1)) AS pct_utilizacao
                FROM coletores_base
                GROUP BY filial
                HAVING COALESCE(SUM(manifestos_bipados), 0) > 0
                    OR MAX(CAST(is_filial_operacional AS INT)) = 1
                ORDER BY pct_utilizacao, total_manifestos DESC, filial
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new UtilizacaoColetoresRankingBase(
                rs.getString("filial"),
                inteiro(rs.getLong("manifestos_bipados")),
                inteiro(rs.getLong("manifestos_emitidos")),
                inteiro(rs.getLong("manifestos_descarregamento")),
                inteiro(rs.getLong("total_manifestos")),
                inteiro(rs.getLong("manifestos_incompletos")),
                rs.getDouble("pct_utilizacao")
        ));
    }

    public List<UtilizacaoColetoresRowDTO> buscarUtilizacaoColetoresLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            int offset,
            int limite
    ) {
        QueryContext ctx = contextoColetores(filtro, escopo);
        ctx.params()
                .addValue("offsetLinhas", Math.max(0, offset))
                .addValue("limiteLinhas", Math.max(1, limite));
        String sql = coletoresLinhasSql("""
                OFFSET :offsetLinhas ROWS FETCH NEXT :limiteLinhas ROWS ONLY
                """);

        return jdbcTemplate.query(sql, ctx.params(), this::mapearColetoresLinha);
    }

    public List<UtilizacaoColetoresRowDTO> buscarUtilizacaoColetoresExportacao(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoColetores(filtro, escopo);
        return jdbcTemplate.query(coletoresLinhasSql(""), ctx.params(), this::mapearColetoresLinha);
    }

    public long contarUtilizacaoColetoresLinhas(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        QueryContext ctx = contextoColetores(filtro, escopo);
        return count(coletoresAgregadosCte() + "SELECT COUNT_BIG(1) FROM coletores_agregados", ctx.params());
    }

    private static String performanceEntregaLinhasSql(String paginacao) {
        return """
                SELECT
                    numero_minuta,
                    CONVERT(NVARCHAR(48), data_frete, 127) AS data_frete,
                    filial_performance,
                    filial_emissora,
                    CONVERT(char(10), previsao_entrega, 23) + 'T00:00:00' AS previsao_entrega,
                    CASE
                        WHEN data_finalizacao IS NULL THEN NULL
                        ELSE CONVERT(char(10), data_finalizacao, 23) + 'T00:00:00'
                    END AS data_finalizacao,
                    performance_diferenca_dias,
                    performance_status
                FROM performance
                ORDER BY previsao_entrega DESC, data_frete DESC, data_finalizacao DESC, numero_minuta DESC
                """ + paginacao;
    }

    private String cubagemLinhasSql(String paginacao) {
        return cubagemCte() + """
                SELECT
                    numero_minuta,
                    CONVERT(NVARCHAR(48), data_frete, 127) AS data_frete,
                    filial,
                    pagador,
                    pagador_documento,
                    destino,
                    COALESCE(peso_taxado, 0) AS peso_taxado,
                    COALESCE(peso_real, 0) AS peso_real,
                    COALESCE(peso_cubado, 0) AS peso_cubado,
                    COALESCE(total_m3, 0) AS total_m3,
                    CAST(is_cubado AS INT) AS cubado
                FROM cubagem
                ORDER BY data_frete DESC, numero_minuta DESC
                """ + paginacao;
    }

    private String indenizacaoLinhasSql(String paginacao) {
        return indenizacaoCte() + """
                SELECT
                    s.numero_sinistro,
                    CONVERT(char(10), s.data_abertura, 23) + 'T00:00:00' AS data_abertura,
                    s.filial,
                    s.minuta,
                    s.valor_a_pagar_cliente,
                    ABS(s.valor_a_pagar_cliente) AS valor_a_pagar_cliente_abs,
                    s.causa_raiz,
                    s.solucao,
                    COALESCE(fp.faturamento, 0) AS faturamento_periodo_filial
                FROM sinistros s
                LEFT JOIN faturamento_periodo fp
                  ON fp.filial = s.filial
                ORDER BY s.data_abertura DESC, ABS(s.valor_a_pagar_cliente) DESC, s.numero_sinistro DESC
                """ + paginacao;
    }

    private String coletoresLinhasSql(String paginacao) {
        return coletoresAgregadosCte() + """
                SELECT
                    CONVERT(char(10), data_referencia, 23) + '|' + filial + '|' + LOWER(classificacao) AS chave,
                    CONVERT(char(10), data_referencia, 23) AS date,
                    filial,
                    classificacao,
                    manifestos_bipados,
                    manifestos_emitidos,
                    manifestos_descarregamento,
                    total_manifestos,
                    manifestos_incompletos,
                    pct_utilizacao
                FROM coletores_agregados
                ORDER BY data_referencia DESC, filial, classificacao
                """ + paginacao;
    }

    private static PerformanceVisaoSql performanceVisaoSql(NivelVisaoPerformance visao) {
        return switch (visao) {
            case RESPONSAVEL -> new PerformanceVisaoSql(
                    "COALESCE(NULLIF(responsavel_regiao_destino, N''), NULLIF(filial_performance, N''), N'Responsável não informado')",
                    "COALESCE(NULLIF(responsavel_regiao_destino, N''), NULLIF(filial_performance, N''), N'Responsável não informado')",
                    "COALESCE(NULLIF(responsavel_regiao_destino, N''), NULLIF(filial_performance, N''), N'Responsável não informado')"
            );
            case REGIAO -> new PerformanceVisaoSql(
                    "COALESCE(NULLIF(regiao_destino, N''), N'SEM_REGIAO')",
                    "COALESCE(NULLIF(regiao_destino, N''), N'SEM_REGIAO')",
                    "COALESCE(NULLIF(regiao_destino, N''), N'SEM_REGIAO')"
            );
            case CIDADE -> new PerformanceVisaoSql(
                    "COALESCE(NULLIF(destino_cidade, N''), N'SEM_CIDADE')",
                    "COALESCE(NULLIF(destino_cidade, N''), N'SEM_CIDADE')",
                    "COALESCE(NULLIF(destino_cidade, N''), N'SEM_CIDADE')"
            );
        };
    }

    private static String filtrosPerformanceDrilldown(
            MapSqlParameterSource params,
            NivelVisaoPerformance visao,
            String responsavelFiltro,
            String regiaoFiltro
    ) {
        StringBuilder where = new StringBuilder();

        if (visao.exigeResponsavelFiltro()) {
            params.addValue("responsavelFiltro", responsavelFiltro);
            where.append("""
                    AND (
                          responsavel_regiao_destino = :responsavelFiltro
                          OR filial_performance = :responsavelFiltro
                          OR (
                              :responsavelFiltro = N'Responsável não informado'
                              AND (responsavel_regiao_destino IS NULL OR responsavel_regiao_destino = N'')
                              AND (filial_performance IS NULL OR filial_performance = N'')
                          )
                    )
                    """);
        }

        if (visao.exigeRegiaoFiltro()) {
            params.addValue("regiaoFiltro", regiaoFiltro);
            where.append("""
                    AND (
                          regiao_destino = :regiaoFiltro
                          OR (:regiaoFiltro = N'SEM_REGIAO' AND (regiao_destino IS NULL OR regiao_destino = N''))
                    )
                    """);
        }

        return where.toString();
    }

    private record PerformanceVisaoSql(
            String labelSql,
            String filtroSql,
            String groupBySql
    ) {
    }

    private static String cubagemCte() {
        return """
                WITH cubagem AS (
                    SELECT
                        numero_minuta,
                        data_frete,
                        data_referencia AS data_frete_date,
                        COALESCE(filial_emissora, N'Filial nao informada') AS filial,
                        filial_emissora_key AS filial_key,
                        COALESCE(pagador_nome, N'Pagador nao informado') AS pagador,
                        COALESCE(pagador_documento_key, pagador_documento) AS pagador_documento,
                        destino,
                        peso_taxado,
                        peso_real,
                        peso_cubado,
                        total_m3,
                        is_cubado,
                        is_peso_real_informado,
                        data_extracao
                    FROM dbo.fato_gestao_vista_fretes
                    WHERE indicador_codigo = 'CB'
                      AND data_referencia >= :dataInicio
                      AND data_referencia < :dataFimExclusivo
                      AND is_linha_valida_indicador = 1
                      AND is_pagador_excluido_cubagem = 0
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dbo.cliente_excecao_cubagem excecao
                          WHERE excecao.cliente_cnpj = pagador_documento_key
                            AND excecao.ativo = 1
                      )
                      AND excluido_na_origem = 0
                      AND (:escopoFiliaisVazio = 1 OR filial_emissora_key IN (:escopoFiliais))
                      AND (:filiaisVazio = 1 OR filial_emissora_key IN (:filiais))
                )
                """;
    }

    private static String indenizacaoCte() {
        return """
                WITH fretes_faturamento AS (
                    SELECT
                        COALESCE(filial_nome, N'Filial nao informada') AS filial,
                        LOWER(COALESCE(filial_nome, N'Filial nao informada')) AS filial_key,
                        DATEFROMPARTS(
                            YEAR(data_referencia_faturamento_date),
                            MONTH(data_referencia_faturamento_date),
                            1
                        ) AS mes_ref,
                        receita_bruta AS faturamento,
                        CAST(snapshot_em AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS DATETIME2) AS data_extracao
                    FROM dbo.fato_fretes_faturamento
                    WHERE data_referencia_faturamento_date >= :dataInicio
                      AND data_referencia_faturamento_date < :dataFimExclusivo
                      AND excluido_na_origem = 0
                      AND (:escopoFiliaisVazio = 1 OR LOWER(COALESCE(filial_nome, N'Filial nao informada')) IN (:escopoFiliais))
                      AND (:filiaisVazio = 1 OR LOWER(COALESCE(filial_nome, N'Filial nao informada')) IN (:filiais))
                ),
                faturamento_periodo AS (
                    SELECT
                        filial,
                        SUM(COALESCE(faturamento, 0)) AS faturamento,
                        MAX(data_extracao) AS updated_at
                    FROM fretes_faturamento
                    GROUP BY filial
                ),
                faturamento_mensal AS (
                    SELECT
                        mes_ref,
                        filial,
                        SUM(COALESCE(faturamento, 0)) AS faturamento
                    FROM fretes_faturamento
                    GROUP BY mes_ref, filial
                ),
                sinistros_fonte AS (
                    SELECT
                        TRY_CONVERT(BIGINT, [Nº do Sinistro]) AS numero_sinistro,
                        TRY_CONVERT(date, CONVERT(NVARCHAR(64), [Data abertura])) AS data_abertura,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Pessoa/Nome fantasia]))), ''), N'Não mapeada') AS filial,
                        LOWER(COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Pessoa/Nome fantasia]))), ''), N'Não mapeada')) AS filial_key,
                        TRY_CONVERT(BIGINT, [Minuta]) AS minuta,
                        COALESCE(TRY_CONVERT(DECIMAL(18, 2), [valor a pagar ao cliente]), 0) AS valor_a_pagar_cliente,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Ocorrência/Descrição]))), '') AS causa_raiz,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tratativa/Solução]))), '') AS solucao,
                        TRY_CONVERT(datetime2, [Data de extracao]) AS data_extracao
                    FROM dbo.vw_sinistros_powerbi
                    WHERE [Data abertura] >= :dataInicio
                      AND [Data abertura] < :dataFimExclusivo
                ),
                sinistros_deduplicados AS (
                    SELECT *,
                        ROW_NUMBER() OVER (
                            PARTITION BY numero_sinistro
                            ORDER BY data_extracao DESC, numero_sinistro DESC
                        ) AS rn
                    FROM sinistros_fonte
                    WHERE numero_sinistro IS NOT NULL
                      AND data_abertura IS NOT NULL
                ),
                sinistros AS (
                    SELECT *
                    FROM sinistros_deduplicados
                    WHERE rn = 1
                      AND (:escopoFiliaisVazio = 1 OR filial_key IN (:escopoFiliais))
                      AND (:filiaisVazio = 1 OR filial_key IN (:filiais))
                )
                """;
    }

    private static String coletoresAgregadosCte() {
        return coletoresFatoCte() + """
                , coletores_agregados AS (
                    SELECT
                        data_referencia,
                        filial,
                        classificacao,
                        COALESCE(SUM(manifestos_bipados), 0) AS manifestos_bipados,
                        COALESCE(SUM(manifestos_emitidos), 0) AS manifestos_emitidos,
                        COALESCE(SUM(manifestos_descarregamento), 0) AS manifestos_descarregamento,
                        COALESCE(SUM(total_manifestos), 0) AS total_manifestos,
                        COALESCE(SUM(manifestos_incompletos), 0) AS manifestos_incompletos,
                        CAST(CASE
                            WHEN COALESCE(SUM(total_manifestos), 0) > 0
                                THEN ROUND(
                                    (CONVERT(DECIMAL(19, 4), COALESCE(SUM(manifestos_bipados), 0)) * CONVERT(DECIMAL(19, 4), 100.0))
                                    / CONVERT(DECIMAL(19, 4), COALESCE(SUM(total_manifestos), 0)),
                                    1
                                )
                            ELSE 0
                        END AS DECIMAL(9, 1)) AS pct_utilizacao
                    FROM coletores_base
                    GROUP BY data_referencia, filial, classificacao
                )
                """;
    }

    private static String coletoresFatoCte() {
        return """
                WITH coletores_base AS (
                    SELECT
                        data_referencia,
                        COALESCE(filial, N'Filial nao informada') AS filial,
                        COALESCE(classificacao, N'Geral') AS classificacao,
                        manifestos_bipados,
                        manifestos_emitidos,
                        manifestos_descarregamento,
                        total_manifestos,
                        manifestos_incompletos,
                        is_filial_operacional,
                        updated_at
                    FROM dbo.fato_gestao_vista_coletores
                    WHERE data_referencia >= :dataInicio
                      AND data_referencia < :dataFimExclusivo
                      AND is_linha_valida_indicador = 1
                      AND excluido_na_origem = 0
                      AND (:escopoFiliaisVazio = 1 OR filial_key IN (:escopoFiliais))
                      AND (:filiaisVazio = 1 OR filial_key IN (:filiais))
                )
                """;
    }

    private QueryContext contextoLocalDate(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            boolean coletores
    ) {
        MapSqlParameterSource params = paramsComuns(filtro, escopo, coletores)
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1));
        return new QueryContext(params);
    }

    private QueryContext contextoIndenizacao(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        JanelaOffsetDateTime janela = periodoOffsetDateTimeHelper.criarJanela(filtro.dataInicio(), filtro.dataFim());
        MapSqlParameterSource params = paramsComuns(filtro, escopo, false)
                .addValue("dataInicio", filtro.dataInicio())
                .addValue("dataFimExclusivo", filtro.dataFim().plusDays(1))
                .addValue("inicioOffset", janela.inicioInclusivo())
                .addValue("fimOffset", janela.fimExclusivo());
        return new QueryContext(params);
    }

    private QueryContext contextoColetores(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo
    ) {
        return contextoLocalDate(filtro, escopo, true);
    }

    private MapSqlParameterSource paramsComuns(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            boolean coletores
    ) {
        List<String> escopoFiliais = coletores
                ? normalizarColetores(escopo.filiaisOrdenadas())
                : normalizar(escopo.filiaisOrdenadas());
        List<String> filiaisFiltro = coletores
                ? normalizarColetores(filtro.valores("filiais"))
                : normalizar(filtro.valores("filiais"));

        boolean escopoVazio = escopo.acessoTotal();
        if (escopoFiliais.isEmpty()) {
            escopoFiliais = List.of("__sem_acesso__");
        }
        if (filiaisFiltro.isEmpty()) {
            filiaisFiltro = List.of("__sem_filtro__");
        }

        return new MapSqlParameterSource()
                .addValue("statusCancelado", STATUS_CANCELADO)
                .addValue("performanceEmAberto", PERFORMANCE_EM_ABERTO)
                .addValue("valorMinimoOperacional", VALOR_MINIMO_OPERACIONAL)
                .addValue("documentosFiliaisOperacionais", DOCUMENTOS_FILIAIS_OPERACIONAIS)
                .addValue("escopoFiliais", escopoFiliais)
                .addValue("escopoFiliaisVazio", escopoVazio ? 1 : 0)
                .addValue("filiais", filiaisFiltro)
                .addValue("filiaisVazio", filtro.temFiltro("filiais") ? 0 : 1);
    }

    private PerformanceEntregaRowDTO mapearPerformanceEntregaLinha(ResultSet rs, int rowNum) throws SQLException {
        return new PerformanceEntregaRowDTO(
                rs.getLong("numero_minuta"),
                rs.getString("data_frete"),
                rs.getString("filial_performance"),
                rs.getString("filial_emissora"),
                rs.getString("previsao_entrega"),
                rs.getString("data_finalizacao"),
                inteiroOuNulo(rs, "performance_diferenca_dias"),
                rs.getString("performance_status")
        );
    }

    private CubagemMercadoriasRowDTO mapearCubagemLinha(ResultSet rs, int rowNum) throws SQLException {
        return new CubagemMercadoriasRowDTO(
                rs.getLong("numero_minuta"),
                rs.getString("data_frete"),
                rs.getString("filial"),
                rs.getString("pagador"),
                rs.getString("pagador_documento"),
                rs.getString("destino"),
                decimal(rs, "peso_taxado"),
                decimal(rs, "peso_real"),
                decimal(rs, "peso_cubado"),
                decimal(rs, "total_m3"),
                rs.getInt("cubado") == 1
        );
    }

    private IndenizacaoMercadoriasRowDTO mapearIndenizacaoLinha(ResultSet rs, int rowNum) throws SQLException {
        BigDecimal valorAbs = escala(decimal(rs, "valor_a_pagar_cliente_abs"), 2);
        BigDecimal faturamentoFilial = decimal(rs, "faturamento_periodo_filial");
        return new IndenizacaoMercadoriasRowDTO(
                rs.getLong("numero_sinistro"),
                rs.getString("data_abertura"),
                rs.getString("filial"),
                longoOuNulo(rs, "minuta"),
                escala(decimal(rs, "valor_a_pagar_cliente"), 2),
                valorAbs,
                rs.getString("causa_raiz"),
                rs.getString("solucao"),
                percentual(valorAbs, faturamentoFilial)
        );
    }

    private UtilizacaoColetoresRowDTO mapearColetoresLinha(ResultSet rs, int rowNum) throws SQLException {
        return new UtilizacaoColetoresRowDTO(
                rs.getString("chave"),
                rs.getString("date"),
                rs.getString("filial"),
                rs.getString("classificacao"),
                inteiro(rs.getLong("manifestos_bipados")),
                inteiro(rs.getLong("manifestos_emitidos")),
                inteiro(rs.getLong("manifestos_descarregamento")),
                inteiro(rs.getLong("total_manifestos")),
                inteiro(rs.getLong("manifestos_incompletos")),
                rs.getDouble("pct_utilizacao")
        );
    }

    private static PerformanceEntregaResumo resumoPerformance(java.util.Map<String, Object> row) {
        return new PerformanceEntregaResumo(
                TemporalJsonUtils.garantirIsoComOffset(texto(row, "updated_at")),
                longo(row, "total_entregas"),
                longo(row, "finalizadas"),
                longo(row, "entregas_no_prazo"),
                longo(row, "entregas_fora_do_prazo")
        );
    }

    private static CubagemResumo resumoCubagem(java.util.Map<String, Object> row) {
        return new CubagemResumo(
                TemporalJsonUtils.garantirIsoComOffset(texto(row, "updated_at")),
                longo(row, "total_fretes"),
                longo(row, "fretes_cubados"),
                longo(row, "fretes_com_peso_real")
        );
    }

    private static IndenizacaoResumo resumoIndenizacao(java.util.Map<String, Object> row) {
        return new IndenizacaoResumo(
                TemporalJsonUtils.garantirIsoComOffset(texto(row, "updated_at")),
                longo(row, "total_sinistros"),
                escala(decimal(row, "valor_indenizado_abs"), 2),
                escala(decimal(row, "valor_indenizado_original"), 2),
                escala(decimal(row, "faturamento_base"), 2)
        );
    }

    private static UtilizacaoColetoresResumo resumoColetores(java.util.Map<String, Object> row) {
        return new UtilizacaoColetoresResumo(
                TemporalJsonUtils.garantirIsoComOffset(texto(row, "updated_at")),
                longo(row, "manifestos_bipados"),
                longo(row, "manifestos_emitidos"),
                longo(row, "manifestos_descarregamento"),
                longo(row, "total_manifestos"),
                longo(row, "manifestos_incompletos"),
                decimal(row, "pct_utilizacao").doubleValue()
        );
    }

    private long count(String sql, MapSqlParameterSource params) {
        Long total = jdbcTemplate.queryForObject(sql, params, Long.class);
        return total != null ? total : 0L;
    }

    private static Integer inteiroOuNulo(ResultSet rs, String coluna) throws SQLException {
        int valor = rs.getInt(coluna);
        return rs.wasNull() ? null : valor;
    }

    private static Long longoOuNulo(ResultSet rs, String coluna) throws SQLException {
        long valor = rs.getLong(coluna);
        return rs.wasNull() ? null : valor;
    }

    private static BigDecimal decimal(ResultSet rs, String coluna) throws SQLException {
        BigDecimal valor = rs.getBigDecimal(coluna);
        return valor != null ? valor : BigDecimal.ZERO;
    }

    private static String texto(java.util.Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        return valor == null ? null : String.valueOf(valor);
    }

    private static long longo(java.util.Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        return valor instanceof Number number ? number.longValue() : 0L;
    }

    private static BigDecimal decimal(java.util.Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        if (valor instanceof BigDecimal decimal) {
            return decimal;
        }
        if (valor instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return BigDecimal.ZERO;
    }

    private static BigDecimal escala(BigDecimal valor, int escala) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(escala, RoundingMode.HALF_UP);
    }

    private static int inteiro(long valor) {
        if (valor > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        if (valor < Integer.MIN_VALUE) {
            return Integer.MIN_VALUE;
        }
        return (int) valor;
    }

    private static double percentual(long numerador, long denominador) {
        if (denominador <= 0) {
            return 0.0;
        }
        return BigDecimal.valueOf((numerador * 100.0) / denominador)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static double percentual(BigDecimal numerador, BigDecimal denominador) {
        if (numerador == null || denominador == null || denominador.compareTo(BigDecimal.ZERO) <= 0) {
            return 0.0;
        }
        return numerador.multiply(BigDecimal.valueOf(100))
                .divide(denominador, 3, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static List<String> normalizar(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private static List<String> normalizarColetores(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(IndicadoresGestaoAVistaSqlRepository::canonicalizarFilialColetores)
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private static String canonicalizarFilialColetores(String filial) {
        if (filial == null || filial.isBlank()) {
            return filial;
        }
        String valor = filial.trim();
        String normalizado = valor.toLowerCase(Locale.ROOT);
        for (String canonica : FILIAIS_COLETORES_PADRAO) {
            String codigo = canonica.substring(0, canonica.indexOf(" - "));
            String codigoLower = codigo.toLowerCase(Locale.ROOT);
            if (normalizado.equals(codigoLower)
                    || normalizado.equals(canonica.toLowerCase(Locale.ROOT))
                    || normalizado.equals("tr rodogarcia | " + codigoLower)
                    || normalizado.equals("rodogarcia filial " + codigoLower)) {
                return canonica;
            }
        }
        return valor;
    }

    private record QueryContext(MapSqlParameterSource params) {
    }

    public record PerformanceEntregaResumo(
            String updatedAt,
            long totalEntregas,
            long finalizadas,
            long entregasNoPrazo,
            long entregasForaDoPrazo
    ) {
    }

    public record CubagemResumo(
            String updatedAt,
            long totalFretes,
            long fretesCubados,
            long fretesComPesoReal
    ) {
    }

    public record IndenizacaoResumo(
            String updatedAt,
            long totalSinistros,
            BigDecimal valorIndenizadoAbs,
            BigDecimal valorIndenizadoOriginal,
            BigDecimal faturamentoBase
    ) {
    }

    public record UtilizacaoColetoresResumo(
            String updatedAt,
            long manifestosBipados,
            long manifestosEmitidos,
            long manifestosDescarregamento,
            long totalManifestos,
            long manifestosIncompletos,
            double pctUtilizacao
    ) {
    }

    public record UtilizacaoColetoresRankingBase(
            String filial,
            int manifestosBipados,
            int manifestosEmitidos,
            int manifestosDescarregamento,
            int totalManifestos,
            int manifestosIncompletos,
            double pctUtilizacao
    ) {
    }
}
