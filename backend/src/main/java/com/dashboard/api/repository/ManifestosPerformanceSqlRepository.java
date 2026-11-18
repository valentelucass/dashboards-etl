package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.manifestos.ManifestosCustosEvolucaoDTO.CustoDiarioDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.CustoContratoDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.GaugeMetricDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.KpisManifestosDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.StatusSazonalDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.TipoVeiculoDTO;
import com.dashboard.api.service.ValidadorPeriodoService;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.JanelaOffsetDateTime;
import com.dashboard.api.util.FilialKeyUtils;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ManifestosPerformanceSqlRepository implements ManifestosCostDataRepository {

    private static final String MANIFESTOS_VIEW = "dbo.vw_fato_manifestos_dash";

    private static final GaugeMetricDTO GAUGE_ZERADO = new GaugeMetricDTO(
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ValidadorPeriodoService validadorPeriodo;
    private final EscopoFilialService escopoFilialService;
    private final PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper;
    private volatile ManifestosViewColumns manifestosViewColumns;

    public ManifestosPerformanceSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            ValidadorPeriodoService validadorPeriodo,
            EscopoFilialService escopoFilialService,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.validadorPeriodo = validadorPeriodo;
        this.escopoFilialService = escopoFilialService;
        this.periodoOffsetDateTimeHelper = periodoOffsetDateTimeHelper;
    }

    public ManifestosPerformanceDTO buscarPerformance(
            FiltroConsultaDTO filtro,
            String nivel,
            Integer ano,
            Integer mes
    ) {
        QueryContext ctx = criarContexto(filtro);
        Map<String, Object> overview = jdbcTemplate.queryForMap(sqlOverview(ctx), ctx.params());
        Gauges gauges = buscarGauges(ctx);

        KpisManifestosDTO kpis = new KpisManifestosDTO(
                longo(overview, "total_manifestos"),
                longo(overview, "em_transito"),
                longo(overview, "pendentes"),
                longo(overview, "encerrados"),
                escala(decimal(overview, "km_total"), 2),
                escala(decimal(overview, "custo_total"), 2),
                escala(decimal(overview, "custo_por_kg"), 2),
                escala(decimal(overview, "custo_por_km"), 2),
                escala(decimal(overview, "receita_por_kg"), 2),
                escala(decimal(overview, "receita_por_km"), 2)
        );

        return new ManifestosPerformanceDTO(
                TemporalJsonUtils.garantirIsoComOffset(texto(overview, "updated_at")),
                0,
                kpis,
                gauges.remuneracao(),
                gauges.aproveitamento(),
                gauges.efetividade(),
                buscarStatusSazonal(ctx, nivel, ano, mes),
                buscarCustosContrato(ctx),
                buscarTiposVeiculo(ctx),
                null
        );
    }

    @Override
    public List<CustoDiarioDTO> buscarCustosDiarios(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT
                    CONVERT(char(10), data_criacao_date, 23) AS data,
                    COALESCE(SUM(custo_total), 0) AS custo_real
                FROM manifestos
                WHERE data_criacao_date IS NOT NULL
                """ + ctx.where() + """
                GROUP BY data_criacao_date
                ORDER BY data_criacao_date
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new CustoDiarioDTO(
                rs.getString("data"),
                escala(rs.getBigDecimal("custo_real"), 2)
        ));
    }

    @Override
    public BigDecimal buscarCustoTotal(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT COALESCE(SUM(custo_total), 0)
                FROM manifestos
                WHERE 1 = 1
                """ + ctx.where();
        BigDecimal custoTotal = jdbcTemplate.queryForObject(sql, ctx.params(), BigDecimal.class);
        return escala(custoTotal, 2);
    }

    @Override
    public LocalDate buscarUltimoDiaUtilFechado(LocalDate dataReferencia) {
        return jdbcTemplate.queryForObject("""
                SELECT MAX(data)
                FROM dbo.dim_calendario
                WHERE data < :dataReferencia
                  AND is_dia_util = 1
                """, new MapSqlParameterSource("dataReferencia", dataReferencia), LocalDate.class);
    }

    @Override
    public Integer contarDiasUteisCalendario(LocalDate dataInicio, LocalDate dataFim) {
        return jdbcTemplate.queryForObject("""
                SELECT CAST(COUNT_BIG(1) AS INT)
                FROM dbo.dim_calendario
                WHERE data >= :dataInicio
                  AND data <= :dataFim
                  AND is_dia_util = 1
                """, new MapSqlParameterSource()
                .addValue("dataInicio", dataInicio)
                .addValue("dataFim", dataFim), Integer.class);
    }

    private Gauges buscarGauges(QueryContext ctx) {
        List<GaugeBucket> buckets = jdbcTemplate.query(sqlGauges(ctx), ctx.params(), (rs, rowNum) -> new GaugeBucket(
                rs.getString("bucket"),
                escala(rs.getBigDecimal("remuneracao"), 2),
                escala(rs.getBigDecimal("aproveitamento"), 2),
                escala(rs.getBigDecimal("efetividade"), 2)
        ));

        if (buckets.isEmpty()) {
            return new Gauges(GAUGE_ZERADO, GAUGE_ZERADO, GAUGE_ZERADO);
        }

        return new Gauges(
                montarGauge(buckets, "remuneracao"),
                montarGauge(buckets, "aproveitamento"),
                montarGauge(buckets, "efetividade")
        );
    }

    private List<StatusSazonalDTO> buscarStatusSazonal(QueryContext ctx, String nivel, Integer ano, Integer mes) {
        TemporalQuery temporal = temporalQuery(nivel, ano, mes, ctx.periodoInicio(), ctx.periodoFim());
        MapSqlParameterSource params = copiarParams(ctx.params());
        temporal.parametros().forEach(params::addValue);

        String sql = ctx.baseCte() + """
                SELECT
                    CONVERT(char(10), %s, 23) AS data,
                    SUM(CASE WHEN status_norm = N'Encerrado' THEN 1 ELSE 0 END) AS encerrado,
                    SUM(CASE WHEN status_norm = N'Em Trânsito' THEN 1 ELSE 0 END) AS em_transito,
                    SUM(CASE WHEN status_norm = N'Pendente' THEN 1 ELSE 0 END) AS pendente
                FROM manifestos
                WHERE 1 = 1
                """.formatted(temporal.expressaoData()) + ctx.where() + temporal.where() + """
                GROUP BY %s
                ORDER BY %s
                """.formatted(temporal.expressaoData(), temporal.expressaoData());

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new StatusSazonalDTO(
                rs.getString("data"),
                rs.getLong("encerrado"),
                rs.getLong("em_transito"),
                rs.getLong("pendente")
        ));
    }

    private List<CustoContratoDTO> buscarCustosContrato(QueryContext ctx) {
        String sql = ctx.baseCte() + """
                SELECT
                    tipo_contrato,
                    COALESCE(SUM(custo_total), 0) AS custo_total
                FROM manifestos
                WHERE 1 = 1
                """ + ctx.where() + """
                GROUP BY tipo_contrato
                HAVING COALESCE(SUM(custo_total), 0) > 0
                ORDER BY custo_total DESC, tipo_contrato
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new CustoContratoDTO(
                rs.getString("tipo_contrato"),
                escala(rs.getBigDecimal("custo_total"), 2)
        ));
    }

    private List<TipoVeiculoDTO> buscarTiposVeiculo(QueryContext ctx) {
        String sql = ctx.baseCte() + """
                SELECT
                    tipo_veiculo AS tipo,
                    COUNT(DISTINCT sequence_code) AS quantidade,
                    CAST(COALESCE(
                        SUM(peso_taxado) * 100.0 / NULLIF(SUM(capacidade_veiculo), 0),
                        0
                    ) AS FLOAT) AS aproveitamento_medio,
                    CAST(COALESCE(
                        SUM(itens_entrega + itens_coleta) * 1.0 / NULLIF(COUNT(DISTINCT sequence_code), 0),
                        0
                    ) AS FLOAT) AS media_eventos
                FROM manifestos
                WHERE 1 = 1
                """ + ctx.where() + """
                GROUP BY tipo_veiculo
                ORDER BY quantidade DESC, tipo_veiculo
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new TipoVeiculoDTO(
                rs.getString("tipo"),
                rs.getLong("quantidade"),
                doubleNullable(rs, "aproveitamento_medio"),
                doubleNullable(rs, "media_eventos")
        ));
    }

    private String sqlOverview(QueryContext ctx) {
        return ctx.baseCte() + """
                SELECT
                    CONVERT(varchar(19), MAX(data_extracao), 126) AS updated_at,
                    COUNT_BIG(1) AS total_manifestos,
                    SUM(CASE WHEN status_norm = N'Em Trânsito' THEN 1 ELSE 0 END) AS em_transito,
                    SUM(CASE WHEN status_norm = N'Pendente' THEN 1 ELSE 0 END) AS pendentes,
                    SUM(CASE WHEN status_norm = N'Encerrado' THEN 1 ELSE 0 END) AS encerrados,
                    COALESCE(SUM(km_total), 0) AS km_total,
                    COALESCE(SUM(custo_total), 0) AS custo_total,
                    CASE
                        WHEN COALESCE(SUM(peso_taxado), 0) > 0
                        THEN COALESCE(SUM(custo_total), 0) / NULLIF(SUM(peso_taxado), 0)
                        ELSE 0
                    END AS custo_por_kg,
                    CASE
                        WHEN COALESCE(SUM(km_total), 0) > 0
                        THEN COALESCE(SUM(custo_total), 0) / NULLIF(SUM(km_total), 0)
                        ELSE 0
                    END AS custo_por_km,
                    CASE
                        WHEN COALESCE(SUM(peso_taxado), 0) > 0
                        THEN COALESCE(SUM(receita_total), 0) / NULLIF(SUM(peso_taxado), 0)
                        ELSE 0
                    END AS receita_por_kg,
                    CASE
                        WHEN COALESCE(SUM(km_total), 0) > 0
                        THEN COALESCE(SUM(receita_total), 0) / NULLIF(SUM(km_total), 0)
                        ELSE 0
                    END AS receita_por_km
                FROM manifestos
                WHERE 1 = 1
                """ + ctx.where();
    }

    private String sqlGauges(QueryContext ctx) {
        return ctx.baseCte() + """
                SELECT
                    CASE
                        WHEN GROUPING(classificacao_bucket) = 1 THEN N'global'
                        ELSE classificacao_bucket
                    END AS bucket,
                    CASE
                        WHEN COALESCE(SUM(receita_total), 0) > 0
                        THEN COALESCE(SUM(custo_total), 0) * 100.0 / NULLIF(SUM(receita_total), 0)
                        ELSE 0
                    END AS remuneracao,
                    CASE
                        WHEN COALESCE(SUM(capacidade_veiculo), 0) > 0
                        THEN COALESCE(SUM(peso_taxado), 0) * 100.0 / NULLIF(SUM(capacidade_veiculo), 0)
                        ELSE 0
                    END AS aproveitamento,
                    CASE
                        WHEN COALESCE(SUM(servicos_total), 0) > 0
                        THEN COALESCE(SUM(servicos_finalizados), 0) * 100.0 / NULLIF(SUM(servicos_total), 0)
                        ELSE 0
                    END AS efetividade
                FROM manifestos
                WHERE 1 = 1
                """ + ctx.where() + """
                GROUP BY GROUPING SETS ((classificacao_bucket), ())
                """;
    }

    private QueryContext criarContexto(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        JanelaOffsetDateTime janela = periodoOffsetDateTimeHelper.criarJanela(filtro.dataInicio(), filtro.dataFim());
        QueryContext ctx = new QueryContext(new StringBuilder(), new MapSqlParameterSource()
                .addValue("inicioOffset", janela.inicioInclusivo())
                .addValue("fimOffset", janela.fimExclusivo()),
                carregarColunasManifestos(),
                filtro.dataInicio(),
                filtro.dataFim());

        aplicarEscopo(ctx);
        adicionarFiltroFiliais(ctx.whereBuilder(), ctx.params(), filtro.valores("filiais"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "status", "status_norm", filtro.valores("status"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "motoristas", "motorista", filtro.valores("motoristas"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "veiculos", "veiculo_placa", filtro.valores("veiculos"));
        adicionarFiltroNumero(ctx.whereBuilder(), ctx.params(), "numeroManifesto", "sequence_code", filtro.valores("numeroManifesto"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "classificacoes", "[Classificação]", filtro.valores("classificacoes"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "tiposCarga", "tipo_carga", filtro.valores("tiposCarga"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "tiposContrato", "tipo_contrato_key", filtro.valores("tiposContrato"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "tipoMotorista", "tipo_motorista", filtro.valores("tipoMotorista"));
        return ctx;
    }

    private void aplicarEscopo(QueryContext ctx) {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        if (escopo.acessoTotal()) {
            return;
        }
        List<String> filiais = normalizarFiliais(escopo.filiaisOrdenadas());
        if (filiais.isEmpty()) {
            ctx.whereBuilder().append("\n AND 1 = 0");
            return;
        }
        ctx.params().addValue("escopoFiliais", filiais);
        ctx.whereBuilder().append("\n AND filial_key COLLATE Latin1_General_CI_AI IN (:escopoFiliais)");
    }

    private static void adicionarFiltroFiliais(
            StringBuilder where,
            MapSqlParameterSource params,
            Collection<String> valores
    ) {
        if (!FilialKeyUtils.possuiTexto(valores)) {
            return;
        }
        List<String> normalizados = normalizarFiliais(valores);
        if (normalizados.isEmpty()) {
            where.append("\n AND 1 = 0");
            return;
        }
        params.addValue("filiais", normalizados);
        where.append("\n AND filial_key COLLATE Latin1_General_CI_AI IN (:filiais)");
    }

    private static void adicionarFiltroTexto(
            StringBuilder where,
            MapSqlParameterSource params,
            String chave,
            String campo,
            Collection<String> valores
    ) {
        List<String> normalizados = normalizar(valores);
        if (normalizados.isEmpty()) {
            return;
        }
        params.addValue(chave, normalizados);
        where.append("\n AND ")
                .append(campo)
                .append(" COLLATE Latin1_General_CI_AI IN (:")
                .append(chave)
                .append(")");
    }

    private static void adicionarFiltroNumero(
            StringBuilder where,
            MapSqlParameterSource params,
            String chave,
            String campo,
            Collection<String> valores
    ) {
        Long numero = parseLongOrNull(primeiroValor(valores));
        if (numero == null) {
            return;
        }

        params.addValue(chave, numero);
        where.append("\n AND ")
                .append(campo)
                .append(" = :")
                .append(chave)
                .append(" ");
    }

    private static String primeiroValor(Collection<String> valores) {
        if (valores == null) {
            return null;
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(String::trim)
                .findFirst()
                .orElse(null);
    }

    private static Long parseLongOrNull(String valor) {
        if (valor == null || !valor.matches("\\d+")) {
            return null;
        }
        try {
            return Long.parseLong(valor);
        } catch (NumberFormatException ex) {
            return null;
        }
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

    private static List<String> normalizarFiliais(Collection<String> valores) {
        return FilialKeyUtils.normalizarCodigosParaFiltro(valores);
    }

    private TemporalQuery temporalQuery(
            String nivel,
            Integer ano,
            Integer mes,
            LocalDate periodoInicio,
            LocalDate periodoFim
    ) {
        String nivelSeguro = nivel == null || nivel.isBlank() ? "dia" : nivel.trim().toLowerCase(Locale.ROOT);
        StringBuilder where = new StringBuilder();
        Map<String, Object> parametros = new LinkedHashMap<>();
        Integer anoSeguro = ano != null && ano > 0 ? ano : null;
        Integer mesSeguro = mes != null && mes >= 1 && mes <= 12 ? mes : null;

        if ("ano".equals(nivelSeguro)) {
            return new TemporalQuery("DATEFROMPARTS(YEAR(data_criacao_date), 1, 1)", "", Map.of());
        }

        if ("mes".equals(nivelSeguro)) {
            if (anoSeguro != null) {
                adicionarIntervaloTemporal(
                        where,
                        parametros,
                        "data_criacao",
                        "inicioTemporal",
                        "fimTemporal",
                        LocalDate.of(anoSeguro, 1, 1),
                        LocalDate.of(anoSeguro + 1, 1, 1)
                );
            }
            return new TemporalQuery(
                    "DATEFROMPARTS(YEAR(data_criacao_date), MONTH(data_criacao_date), 1)",
                    where.toString(),
                    parametros
            );
        }

        if (anoSeguro != null && mesSeguro != null) {
            LocalDate inicio = LocalDate.of(anoSeguro, mesSeguro, 1);
            adicionarIntervaloTemporal(
                        where,
                        parametros,
                        "data_criacao",
                        "inicioTemporal",
                        "fimTemporal",
                    inicio,
                    inicio.plusMonths(1)
            );
        } else if (anoSeguro != null) {
            adicionarIntervaloTemporal(
                    where,
                    parametros,
                    "data_criacao",
                    "inicioTemporal",
                    "fimTemporal",
                    LocalDate.of(anoSeguro, 1, 1),
                    LocalDate.of(anoSeguro + 1, 1, 1)
            );
        } else if (mesSeguro != null) {
            adicionarIntervalosMensaisPorAno(where, parametros, "data_criacao", mesSeguro, periodoInicio, periodoFim);
        }

        return new TemporalQuery("data_criacao_date", where.toString(), parametros);
    }

    private void adicionarIntervaloTemporal(
            StringBuilder where,
            Map<String, Object> parametros,
            String coluna,
            String inicioParam,
            String fimParam,
            LocalDate inicio,
            LocalDate fim
    ) {
        JanelaOffsetDateTime janela = periodoOffsetDateTimeHelper.criarJanela(inicio, fim.minusDays(1));
        parametros.put(inicioParam, janela.inicioInclusivo());
        parametros.put(fimParam, janela.fimExclusivo());
        where.append("\n AND ")
                .append(coluna)
                .append(" >= :")
                .append(inicioParam)
                .append(" AND ")
                .append(coluna)
                .append(" < :")
                .append(fimParam);
    }

    private void adicionarIntervalosMensaisPorAno(
            StringBuilder where,
            Map<String, Object> parametros,
            String coluna,
            int mes,
            LocalDate periodoInicio,
            LocalDate periodoFim
    ) {
        List<String> predicados = new java.util.ArrayList<>();
        int indice = 0;
        for (int ano = periodoInicio.getYear(); ano <= periodoFim.getYear(); ano++) {
            LocalDate inicio = LocalDate.of(ano, mes, 1);
            LocalDate fim = inicio.plusMonths(1);
            String inicioParam = "inicioTemporal" + indice;
            String fimParam = "fimTemporal" + indice;
            JanelaOffsetDateTime janela = periodoOffsetDateTimeHelper.criarJanela(inicio, fim.minusDays(1));
            parametros.put(inicioParam, janela.inicioInclusivo());
            parametros.put(fimParam, janela.fimExclusivo());
            predicados.add("(" + coluna + " >= :" + inicioParam + " AND " + coluna + " < :" + fimParam + ")");
            indice++;
        }
        if (!predicados.isEmpty()) {
            where.append("\n AND (").append(String.join(" OR ", predicados)).append(")");
        }
    }

    private ManifestosViewColumns carregarColunasManifestos() {
        ManifestosViewColumns cached = manifestosViewColumns;
        if (cached != null) {
            return cached;
        }

        ManifestosViewColumns carregadas = carregarColunasViewManifestos();
        if (carregadas.contratoObrigatorioValido()) {
            manifestosViewColumns = carregadas;
        }
        return carregadas;
    }

    private ManifestosViewColumns carregarColunasViewManifestos() {
        List<String> nomes = jdbcTemplate.queryForList("""
                SELECT name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) * FROM %s',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND is_hidden = 0
                ORDER BY column_ordinal
                """.formatted(MANIFESTOS_VIEW), new MapSqlParameterSource(), String.class);
        return new ManifestosViewColumns(nomes);
    }

    private static String baseCte(ManifestosViewColumns colunas) {
        String tipoMotorista = tipoMotoristaSql(colunas);
        String filialKey = filialKeySql(colunas);

        return """
                WITH manifestos AS (
                    SELECT
                        [Número] AS sequence_code,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), ''), N'Sem filial') AS filial,
                        %s AS filial_key,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Motorista]))), ''), N'Sem motorista') AS motorista,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Veículo/Placa]))), ''), N'Sem veículo') AS veiculo_placa,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo Veículo]))), ''), N'Sem tipo') AS tipo_veiculo,
                        %s AS tipo_motorista,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo de carga]))), ''), N'Sem tipo') AS tipo_carga,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo de contrato]))), ''), N'Sem tipo') AS tipo_contrato,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo de contrato key]))), ''), N'sem tipo') AS tipo_contrato_key,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Classificação]))), ''), N'Sem classificação') AS [Classificação],
                        CASE
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) COLLATE Latin1_General_CI_AI IN (N'encerrado', N'closed') THEN N'Encerrado'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) COLLATE Latin1_General_CI_AI IN (N'em trânsito', N'em transito', N'in_transit') THEN N'Em Trânsito'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) COLLATE Latin1_General_CI_AI IN (N'pendente', N'pending') THEN N'Pendente'
                            ELSE N'Pendente'
                        END AS status_norm,
                        CASE
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Classificação])))) COLLATE Latin1_General_CI_AI LIKE N'%%distribu%%' THEN N'distribuicao'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Classificação])))) COLLATE Latin1_General_CI_AI LIKE N'%%transfer%%' THEN N'transferencia'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Classificação])))) COLLATE Latin1_General_CI_AI LIKE N'%%carga%%fechada%%'
                              OR LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo de carga])))) COLLATE Latin1_General_CI_AI LIKE N'%%carga%%fechada%%'
                            THEN N'cargaFechada'
                            ELSE N'distribuicao'
                        END AS classificacao_bucket,
                        [Data criação] AS data_criacao,
                        CAST([Data criação] AS date) AS data_criacao_date,
                        COALESCE([KM Total], 0) AS km_total,
                        COALESCE([Custo total], 0) AS custo_total,
                        COALESCE([Receita Total Transportada], 0) AS receita_total,
                        COALESCE([Total peso taxado], 0) AS peso_taxado,
                        COALESCE([Capacidade Lotação Kg], 0) AS capacidade_veiculo,
                        COALESCE([Itens/Entrega], 0) AS itens_entrega,
                        COALESCE([Itens/Coleta], 0) AS itens_coleta,
                        COALESCE([Itens/Finalizados], 0) AS servicos_finalizados,
                        COALESCE([Itens/Total], 0) AS servicos_total,
                        [Data de extracao] AS data_extracao
                    FROM %s
                    WHERE [Data criação] >= :inicioOffset
                      AND [Data criação] < :fimOffset
                )
                """.formatted(filialKey, tipoMotorista, MANIFESTOS_VIEW);
    }

    private static String filialKeySql(ManifestosViewColumns colunas) {
        String colunaKey = textoNullableSql(
                colunas,
                "filial_key",
                "Filial key",
                "Filial Key",
                "filial_performance_key",
                "Filial Performance Key"
        );
        if (!"NULL".equals(colunaKey)) {
            return "LOWER(" + colunaKey + ") COLLATE Latin1_General_CI_AI";
        }

        String filial = "NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')";
        return """
                LOWER(
                    NULLIF(
                        CASE
                            WHEN %1$s IS NULL THEN NULL
                            WHEN CHARINDEX(N'-', %1$s) > 0 THEN LTRIM(RTRIM(LEFT(%1$s, CHARINDEX(N'-', %1$s) - 1)))
                            WHEN LEN(%1$s) = 3 THEN %1$s
                            ELSE NULL
                        END,
                        N''
                    )
                ) COLLATE Latin1_General_CI_AI
                """.formatted(filial);
    }

    private static String tipoMotoristaSql(ManifestosViewColumns colunas) {
        if (colunas.existe("Tipo Motorista")) {
            return "COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo Motorista]))), ''), N'Terceiro / Autônomo')";
        }

        String proprietario = textoNullableSql(colunas, "Proprietário/Nome", "Proprietário");
        String contrato = textoNullableSql(colunas, "Tipo de contrato", "Tipo contrato");
        String proprietarioNormalizado = "UPPER(LTRIM(RTRIM(COALESCE(CONVERT(NVARCHAR(255), " + proprietario + "), N'')))) COLLATE Latin1_General_CI_AI";
        String contratoNormalizado = "LOWER(LTRIM(RTRIM(COALESCE(CONVERT(NVARCHAR(255), " + contrato + "), N'')))) COLLATE Latin1_General_CI_AI";

        return """
                CASE
                    WHEN %s = N'RODOGARCIA TRANSPORTES RODOVIARIOS LTDA' THEN N'Frota Própria'
                    WHEN %s LIKE N'%%agreg%%'
                      OR %s LIKE N'%%exclusiv%%'
                      OR %s LIKE N'%%frota%%agreg%%'
                    THEN N'Agregado'
                    ELSE N'Terceiro / Autônomo'
                END
                """.formatted(
                proprietarioNormalizado,
                contratoNormalizado,
                contratoNormalizado,
                contratoNormalizado
        );
    }

    private static String textoNullableSql(ManifestosViewColumns colunas, String... nomes) {
        List<String> expressoes = List.of(nomes).stream()
                .filter(colunas::existe)
                .map(ManifestosPerformanceSqlRepository::textoNullableColunaSql)
                .toList();
        if (expressoes.isEmpty()) {
            return "NULL";
        }
        if (expressoes.size() == 1) {
            return expressoes.get(0);
        }
        return "COALESCE(" + String.join(", ", expressoes) + ")";
    }

    private static String textoNullableColunaSql(String nome) {
        return "NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [" + nome + "]))), '')";
    }

    private static MapSqlParameterSource copiarParams(MapSqlParameterSource params) {
        return new MapSqlParameterSource(params.getValues());
    }

    private static GaugeMetricDTO montarGauge(List<GaugeBucket> buckets, String metrica) {
        return new GaugeMetricDTO(
                valorBucket(buckets, "global", metrica),
                valorBucket(buckets, "distribuicao", metrica),
                valorBucket(buckets, "transferencia", metrica),
                valorBucket(buckets, "cargaFechada", metrica)
        );
    }

    private static BigDecimal valorBucket(List<GaugeBucket> buckets, String bucket, String metrica) {
        return buckets.stream()
                .filter(item -> bucket.equals(item.bucket()))
                .map(item -> switch (metrica) {
                    case "aproveitamento" -> item.aproveitamento();
                    case "efetividade" -> item.efetividade();
                    default -> item.remuneracao();
                })
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private static String texto(Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        return valor == null ? null : String.valueOf(valor);
    }

    private static long longo(Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        return valor instanceof Number number ? number.longValue() : 0L;
    }

    private static BigDecimal decimal(Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        if (valor instanceof BigDecimal decimal) {
            return decimal;
        }
        if (valor instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return BigDecimal.ZERO;
    }

    private static Double doubleNullable(ResultSet rs, String coluna) throws SQLException {
        double valor = rs.getDouble(coluna);
        return rs.wasNull() ? null : valor;
    }

    private static BigDecimal escala(BigDecimal valor, int escala) {
        return (valor == null ? BigDecimal.ZERO : valor).setScale(escala, RoundingMode.HALF_UP);
    }

    private record QueryContext(
            StringBuilder whereBuilder,
            MapSqlParameterSource params,
            ManifestosViewColumns colunas,
            LocalDate periodoInicio,
            LocalDate periodoFim
    ) {
        String where() {
            return whereBuilder.toString();
        }

        String baseCte() {
            return ManifestosPerformanceSqlRepository.baseCte(colunas);
        }
    }

    private record Gauges(
            GaugeMetricDTO remuneracao,
            GaugeMetricDTO aproveitamento,
            GaugeMetricDTO efetividade
    ) {
    }

    private record GaugeBucket(
            String bucket,
            BigDecimal remuneracao,
            BigDecimal aproveitamento,
            BigDecimal efetividade
    ) {
    }

    private record TemporalQuery(String expressaoData, String where, Map<String, Object> parametros) {
    }

    private record ManifestosViewColumns(List<String> nomes) {
        boolean existe(String nome) {
            return nomes.contains(nome);
        }

        boolean contratoObrigatorioValido() {
            return existe("Número")
                    && existe("Data criação")
                    && existe("Status")
                    && existe("Classificação")
                    && existe("Filial")
                    && existe("Motorista")
                    && existe("Veículo/Placa")
                    && existe("Tipo Veículo")
                    && existe("Tipo Motorista")
                    && existe("Tipo de contrato")
                    && existe("Tipo de contrato key")
                    && existe("Proprietário/Documento")
                    && existe("KM Total")
                    && existe("Custo total")
                    && existe("Fretes/Total")
                    && existe("Receita Total Transportada")
                    && existe("Total peso taxado")
                    && existe("Capacidade Lotação Kg")
                    && existe("Itens/Entrega")
                    && existe("Itens/Coleta")
                    && existe("Itens/Finalizados")
                    && existe("Itens/Total")
                    && existe("Data de extracao");
        }
    }
}
