package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.dimensoes.DimensaoOpcaoDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.dto.performance.PerformanceAgingPointDTO;
import com.dashboard.api.dto.performance.PerformanceDrilldownPointDTO;
import com.dashboard.api.dto.performance.PerformanceEntregaRowDTO;
import com.dashboard.api.dto.performance.PerformanceHistoricoPointDTO;
import com.dashboard.api.dto.performance.PerformanceOverviewDTO;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.EficienciaFilial;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.EntregaAtencao;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.OcorrenciaAtraso;
import com.dashboard.api.dto.performance.PerformanceSerieTemporalPointDTO;
import com.dashboard.api.dto.performance.PerformanceStatusDistribuicaoDTO;
import com.dashboard.api.dto.performance.PerformanceTabelaProjection;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.service.ValidadorPeriodoService;
import com.dashboard.api.util.ConsultaLimiteUtils;
import com.dashboard.api.util.PerformanceMetricasUtils;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.time.ZoneId;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PerformanceDashboardSqlRepository {

    private static final int TAMANHO_PADRAO = 10;
    private static final int TAMANHO_MAXIMO = 100;
    private static final int DRILLDOWN_LIMITE_PADRAO = 50;
    private static final ZoneId ZONE_ID_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final BigDecimal MIL = BigDecimal.valueOf(1000);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ValidadorPeriodoService validadorPeriodo;
    private final EscopoFilialService escopoFilialService;
    private volatile PerformanceViewColumns performanceViewColumns;

    public PerformanceDashboardSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            ValidadorPeriodoService validadorPeriodo,
            EscopoFilialService escopoFilialService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.validadorPeriodo = validadorPeriodo;
        this.escopoFilialService = escopoFilialService;
    }

    public List<DimensaoOpcaoDTO> listarResponsaveis(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT
                    responsavel_key AS value,
                    MIN(COALESCE(responsavel_regiao_destino, filial_emissora, N'Responsável não informado')) AS label
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where() + """
                  AND responsavel_key IS NOT NULL
                  AND LTRIM(RTRIM(CONVERT(NVARCHAR(255), responsavel_key))) <> ''
                GROUP BY responsavel_key
                ORDER BY label
                OFFSET 0 ROWS FETCH NEXT 200 ROWS ONLY
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new DimensaoOpcaoDTO(
                rs.getString("value"),
                rs.getString("label")
        ));
    }

    public List<String> listarRegioesDestino(FiltroConsultaDTO filtro) {
        return listarValoresDistintos(filtro, "regiao_destino");
    }

    public List<String> listarCidadesDestino(FiltroConsultaDTO filtro) {
        return listarValoresDistintos(filtro, "cidade_destino");
    }

    private List<String> listarValoresDistintos(FiltroConsultaDTO filtro, String campo) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT DISTINCT TOP (200) %s AS valor
                FROM entregas
                WHERE 1 = 1
                """.formatted(campo) + ctx.where() + """
                  AND %s IS NOT NULL
                  AND LTRIM(RTRIM(CONVERT(NVARCHAR(255), %s))) <> ''
                ORDER BY valor
                """.formatted(campo, campo);

        return jdbcTemplate.queryForList(sql, ctx.params(), String.class);
    }

    public PerformanceOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT
                    MAX(data_extracao) AS updated_at,
                    COUNT_BIG(1) AS total_entregas,
                    SUM(is_finalizada) AS finalizadas,
                    SUM(is_no_prazo) AS no_prazo,
                    SUM(is_fora_prazo) AS fora_do_prazo,
                    SUM(CASE WHEN status_norm <> N'Finalizada' AND data_previsao_entrega < :hoje THEN 1 ELSE 0 END) AS em_atraso,
                    COALESCE(SUM(peso_taxado), 0) AS peso_taxado,
                    SUM(CASE WHEN status_norm = N'Finalizada' AND comprovante_anexado = 1 THEN 1 ELSE 0 END) AS finalizadas_com_comprovante,
                    COALESCE(SUM(CASE WHEN status_norm = N'Finalizada' AND comprovante_anexado = 0 THEN valor_nota_fiscal ELSE 0 END), 0) AS valor_nf_sem_comprovante
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where();

        Map<String, Object> row = jdbcTemplate.queryForMap(sql, ctx.params());
        long finalizadas = longo(row, "finalizadas");
        long noPrazo = longo(row, "no_prazo");
        BigDecimal pesoKg = decimal(row, "peso_taxado");

        return new PerformanceOverviewDTO(
                updatedAt(row, "updated_at"),
                longo(row, "total_entregas"),
                finalizadas,
                noPrazo,
                longo(row, "fora_do_prazo"),
                PerformanceMetricasUtils.percentual(noPrazo, finalizadas),
                longo(row, "em_atraso"),
                pesoKg.divide(MIL, 3, RoundingMode.HALF_UP),
                PerformanceMetricasUtils.percentual(longo(row, "finalizadas_com_comprovante"), finalizadas),
                decimal(row, "valor_nf_sem_comprovante").setScale(2, RoundingMode.HALF_UP)
        );
    }

    public List<OcorrenciaAtraso> ocorrenciasAtraso(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        return jdbcTemplate.query(ctx.baseCte() + PerformanceOperacaoSql.ocorrenciasAtraso(ctx.where()),
                ctx.params(), (r, i) -> new OcorrenciaAtraso(r.getString("ocorrencia"), r.getLong("notas")));
    }

    public PaginaDTO<EntregaAtencao> entregasAtencao(FiltroConsultaDTO filtro, int pagina, int tamanho) {
        QueryContext ctx = criarContexto(filtro);
        int limite = ConsultaLimiteUtils.limitar(tamanho, TAMANHO_PADRAO, TAMANHO_MAXIMO);
        int atual = Math.max(1, pagina);
        ctx.params().addValue("offset", (long) (atual - 1) * limite).addValue("limite", limite);
        return jdbcTemplate.query(ctx.baseCte() + PerformanceOperacaoSql.entregasAtencao(ctx.where()),
                ctx.params(), rs -> {
                    List<EntregaAtencao> linhas = new java.util.ArrayList<>();
                    long total = 0;
                    while (rs.next()) {
                        total = rs.getLong("total");
                        if (rs.getObject("numero_minuta") == null) continue;
                        linhas.add(new EntregaAtencao(rs.getLong("numero_minuta"), rs.getString("pagador"),
                                rs.getString("destino"), rs.getObject("data_previsao_entrega", LocalDate.class),
                                rs.getString("status_norm"), rs.getString("alerta"), rs.getString("ultima_ocorrencia")));
                    }
                    return new PaginaDTO<>(linhas, total, (int) Math.ceil((double) total / limite), atual, limite);
                });
    }

    public List<EficienciaFilial> eficienciaFiliais(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        Set<LocalDate> feriados = Set.copyOf(jdbcTemplate.query(
                "SELECT data FROM dbo.dim_calendario WHERE is_feriado_nacional = 1",
                ctx.params(), (r, i) -> r.getObject(1, LocalDate.class)));
        PerformanceEficiencia calculo = new PerformanceEficiencia(filtro.dataInicio(), filtro.dataFim(),
                LocalDateTime.now(ZONE_ID_BRASILIA), feriados);
        String sql = baseCte(ctx.colunas(), true) + PerformanceOperacaoSql.eficiencia(ctx.where());
        return jdbcTemplate.query(sql, ctx.params(), rs -> {
            Long anterior = null;
            List<PerformanceEficiencia.Evento> eventos = new java.util.ArrayList<>();
            PerformanceEficiencia.Frete frete = null;
            while (rs.next()) {
                long numero = rs.getLong("numero_minuta");
                if (anterior == null || numero != anterior) {
                    if (frete != null) calculo.adicionar(frete, eventos);
                    eventos.clear();
                    frete = new PerformanceEficiencia.Frete(rs.getBoolean("is_finalizada"), rs.getBoolean("is_no_prazo"),
                            rs.getObject("data_finalizacao", LocalDate.class));
                    anterior = numero;
                }
                LocalDateTime hora = rs.getObject("ocorrido_em", LocalDateTime.class);
                if (hora != null) eventos.add(new PerformanceEficiencia.Evento(rs.getInt("codigo"), rs.getString("nota_fiscal"),
                        hora, rs.getString("filial"), rs.getBoolean("entrega")));
            }
            if (frete != null) calculo.adicionar(frete, eventos);
            return calculo.resultados();
        });
    }

    public List<PerformanceSerieTemporalPointDTO> buscarSerieTemporal(
            FiltroConsultaDTO filtro,
            String nivel,
            Integer ano,
            Integer mes
    ) {
        QueryContext ctx = criarContexto(filtro);
        TemporalQuery temporal = temporalQuery(nivel, ano, mes, filtro.dataInicio(), filtro.dataFim());
        MapSqlParameterSource params = copiarParams(ctx.params());
        temporal.parametros().forEach(params::addValue);

        String sql = ctx.baseCte() + """
                SELECT
                    CONVERT(char(10), %s, 23) AS date,
                    COUNT_BIG(1) AS total,
                    SUM(is_finalizada) AS finalizadas,
                    SUM(CASE WHEN status_norm = N'Em Trânsito' THEN 1 ELSE 0 END) AS em_transito,
                    SUM(CASE WHEN status_norm = N'Pendente' THEN 1 ELSE 0 END) AS pendentes,
                    SUM(CASE WHEN status_norm = N'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
                    SUM(CASE WHEN status_norm = N'Em Tratativa' THEN 1 ELSE 0 END) AS em_tratativa
                FROM entregas
                WHERE 1 = 1
                """.formatted(temporal.expressaoData()) + ctx.where() + temporal.where() + "\n" + """
                GROUP BY %s
                ORDER BY %s
                """.formatted(temporal.expressaoData(), temporal.expressaoData());

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new PerformanceSerieTemporalPointDTO(
                rs.getString("date"),
                rs.getLong("total"),
                rs.getLong("finalizadas"),
                rs.getLong("em_transito"),
                rs.getLong("pendentes"),
                rs.getLong("canceladas"),
                rs.getLong("em_tratativa")
        ));
    }

    public List<PerformanceStatusDistribuicaoDTO> buscarStatus(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT status_norm AS status, COUNT_BIG(1) AS total
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where() + """
                GROUP BY status_norm
                ORDER BY total DESC, status_norm
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new PerformanceStatusDistribuicaoDTO(
                rs.getString("status"),
                rs.getLong("total")
        ));
    }

    public List<PerformanceHistoricoPointDTO> buscarHistorico(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT
                    CONVERT(char(7), data_previsao_entrega, 23) + '-01' AS date,
                    SUM(is_finalizada) AS finalizadas,
                    SUM(is_no_prazo) AS no_prazo
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where() + """
                GROUP BY CONVERT(char(7), data_previsao_entrega, 23)
                ORDER BY date
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> {
            long finalizadas = rs.getLong("finalizadas");
            long noPrazo = rs.getLong("no_prazo");
            return new PerformanceHistoricoPointDTO(
                    rs.getString("date"),
                    PerformanceMetricasUtils.percentual(noPrazo, finalizadas),
                    95.0,
                    finalizadas,
                    noPrazo
            );
        });
    }

    public List<PerformanceDrilldownPointDTO> buscarDrilldown(
            FiltroConsultaDTO filtro,
            String nivel,
            String responsavel,
            String regiaoDestino
    ) {
        QueryContext ctx = criarContexto(filtro);
        String nivelSeguro = normalizarNivel(nivel);
        String campoGrupo = switch (nivelSeguro) {
            case "regiao" -> "regiao_destino";
            case "cidade" -> "cidade_destino";
            default -> "COALESCE(responsavel_key, responsavel)";
        };
        String campoNome = "responsavel".equals(nivelSeguro)
                ? "MIN(responsavel)"
                : campoGrupo;
        String campoFiltro = campoGrupo;
        if ("regiao".equals(nivelSeguro) || "cidade".equals(nivelSeguro)) {
            adicionarFiltroTextoQualquer(ctx.whereBuilder(), ctx.params(), "responsavelDrill", valorOpcional(responsavel), "responsavel_key", "responsavel");
        }
        if ("cidade".equals(nivelSeguro)) {
            adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "regiaoDrill", "regiao_destino", valorOpcional(regiaoDestino));
        }
        ctx.params().addValue("limiteDrilldown", DRILLDOWN_LIMITE_PADRAO);

        String sql = ctx.baseCte() + """
                SELECT
                    %s AS nome,
                    %s AS filtro,
                    SUM(is_no_prazo) AS no_prazo,
                    SUM(is_fora_prazo) AS fora_do_prazo,
                    SUM(CASE WHEN status_norm <> N'Finalizada' AND data_previsao_entrega < :hoje THEN 1 ELSE 0 END) AS em_atraso,
                    COUNT_BIG(1) AS total
                FROM entregas
                WHERE 1 = 1
                """.formatted(campoNome, campoFiltro) + ctx.where() + """
                GROUP BY %s
                ORDER BY total DESC, nome
                OFFSET 0 ROWS FETCH NEXT :limiteDrilldown ROWS ONLY
                """.formatted(campoGrupo);

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new PerformanceDrilldownPointDTO(
                rs.getString("nome"),
                rs.getString("filtro"),
                nivelSeguro,
                rs.getLong("no_prazo"),
                rs.getLong("fora_do_prazo"),
                rs.getLong("em_atraso"),
                rs.getLong("total")
        ));
    }

    public List<PerformanceAgingPointDTO> buscarAging(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT bucket, COUNT_BIG(1) AS total
                FROM (
                    SELECT CASE
                        WHEN DATEDIFF(day, data_previsao_entrega, :hoje) <= 2 THEN '0-2 dias'
                        WHEN DATEDIFF(day, data_previsao_entrega, :hoje) <= 5 THEN '3-5 dias'
                        WHEN DATEDIFF(day, data_previsao_entrega, :hoje) <= 10 THEN '6-10 dias'
                        ELSE '11+ dias'
                    END AS bucket
                    FROM entregas
                    WHERE status_norm <> N'Finalizada'
                """ + ctx.where() + """
                ) aging
                GROUP BY bucket
                ORDER BY CASE bucket
                    WHEN '0-2 dias' THEN 1
                    WHEN '3-5 dias' THEN 2
                    WHEN '6-10 dias' THEN 3
                    ELSE 4
                END
                """;

        return jdbcTemplate.query(sql, ctx.params(), (rs, rowNum) -> new PerformanceAgingPointDTO(
                rs.getString("bucket"),
                rs.getLong("total")
        ));
    }

    public Page<PerformanceTabelaProjection> buscarTabela(FiltroConsultaDTO filtro, Pageable pageable) {
        QueryContext ctx = criarContexto(filtro);
        int pagina = Math.max(0, pageable.getPageNumber());
        int tamanho = ConsultaLimiteUtils.limitar(pageable.getPageSize(), TAMANHO_PADRAO, TAMANHO_MAXIMO);
        Pageable pageableSeguro = PageRequest.of(pagina, tamanho);
        long offset = pageableSeguro.getOffset();

        String countSql = ctx.baseCte() + """
                SELECT COUNT_BIG(1)
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where();
        Long total = jdbcTemplate.queryForObject(countSql, ctx.params(), Long.class);
        long totalSeguro = total != null ? total : 0L;

        ctx.params()
                .addValue("offsetTabela", offset)
                .addValue("tamanhoTabela", tamanho);
        String selectSql = ctx.baseCte() + """
                SELECT
                    numero_minuta,
                    status_norm,
                    CONVERT(char(10), data_previsao_entrega, 23) AS data_previsao_entrega,
                    CONVERT(char(10), data_finalizacao, 23) AS data_finalizacao,
                    responsavel_regiao_destino,
                    filial_emissora,
                    regiao_destino,
                    cidade_destino,
                    peso_taxado,
                    valor_nota_fiscal,
                    comprovante_anexado,
                    performance_diferenca_dias
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where() + """
                ORDER BY data_previsao_entrega DESC, numero_minuta DESC
                OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY
                """;

        List<PerformanceTabelaProjection> conteudo = jdbcTemplate.query(selectSql, ctx.params(), this::mapearTabelaProjection);

        return new PageImpl<>(conteudo, pageableSeguro, totalSeguro);
    }

    public List<PerformanceTabelaProjection> buscarTabelaExportacao(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = ctx.baseCte() + """
                SELECT
                    numero_minuta,
                    status_norm,
                    CONVERT(char(10), data_previsao_entrega, 23) AS data_previsao_entrega,
                    CONVERT(char(10), data_finalizacao, 23) AS data_finalizacao,
                    responsavel_regiao_destino,
                    filial_emissora,
                    regiao_destino,
                    cidade_destino,
                    peso_taxado,
                    valor_nota_fiscal,
                    comprovante_anexado,
                    performance_diferenca_dias
                FROM entregas
                WHERE 1 = 1
                """ + ctx.where() + """
                ORDER BY data_previsao_entrega DESC, numero_minuta DESC
                """;

        return jdbcTemplate.query(sql, ctx.params(), this::mapearTabelaProjection);
    }

    public PaginaDTO<PerformanceEntregaRowDTO> buscarTabelaPaginada(
            FiltroConsultaDTO filtro,
            int paginaSolicitada,
            int tamanhoSolicitado
    ) {
        int pagina = Math.max(1, paginaSolicitada);
        int tamanho = ConsultaLimiteUtils.limitar(tamanhoSolicitado, TAMANHO_PADRAO, TAMANHO_MAXIMO);
        Page<PerformanceTabelaProjection> paginaResultado = buscarTabela(
                filtro,
                PageRequest.of(pagina - 1, tamanho)
        );
        List<PerformanceEntregaRowDTO> conteudo = paginaResultado.getContent().stream()
                .map(this::paraEntregaRow)
                .toList();

        return new PaginaDTO<>(
                conteudo,
                paginaResultado.getTotalElements(),
                paginaResultado.getTotalPages(),
                pagina,
                paginaResultado.getSize()
        );
    }

    private PerformanceEntregaRowDTO paraEntregaRow(PerformanceTabelaProjection row) {
        return new PerformanceEntregaRowDTO(
                row.numeroMinuta(),
                row.status(),
                row.dataPrevisaoEntrega(),
                row.dataFinalizacao(),
                row.responsavelRegiaoDestino(),
                row.filialEmissora(),
                row.regiaoDestino(),
                row.cidadeDestino(),
                row.pesoTaxado(),
                row.valorNotaFiscal(),
                row.comprovanteAnexado(),
                row.performanceDiferencaDias(),
                row.performanceStatus(),
                row.performanceStatusDias()
        );
    }

    private PerformanceTabelaProjection mapearTabelaProjection(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        Integer diferencaDias = inteiroOuNulo(rs.getObject("performance_diferenca_dias"));
        return new PerformanceTabelaProjection(
                rs.getLong("numero_minuta"),
                rs.getString("status_norm"),
                rs.getString("data_previsao_entrega"),
                rs.getString("data_finalizacao"),
                rs.getString("responsavel_regiao_destino"),
                rs.getString("filial_emissora"),
                rs.getString("regiao_destino"),
                rs.getString("cidade_destino"),
                rs.getBigDecimal("peso_taxado"),
                rs.getBigDecimal("valor_nota_fiscal"),
                rs.getBoolean("comprovante_anexado"),
                diferencaDias,
                PerformanceMetricasUtils.performanceStatus(diferencaDias),
                PerformanceMetricasUtils.performanceStatusDias(diferencaDias)
        );
    }

    record ConsultaEntregas(String sql, MapSqlParameterSource params) {}

    ConsultaEntregas entregasDoCliente(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo,
            List<String> documentos) {
        QueryContext ctx = criarContexto(filtro, escopo);
        ctx.params().addValue("documentos", documentos);
        String sql = baseCte(ctx.colunas(), false, true) + """
                , entregas_cliente AS (
                    SELECT * FROM entregas WHERE 1 = 1
                """ + ctx.where() + ")\n";
        return new ConsultaEntregas(sql, ctx.params());
    }

    ConsultaEntregas entregasDaGestao(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        QueryContext ctx = criarContexto(filtro, escopo);
        String sql = ctx.baseCte() + """
                , performance AS (
                    SELECT numero_minuta, data_frete, data_previsao_entrega AS previsao_entrega,
                           data_finalizacao_performance AS data_finalizacao, responsavel AS filial_performance,
                           filial_emissora, responsavel_regiao_destino, regiao_destino, cidade_destino AS destino_cidade,
                           performance_diferenca_dias, is_finalizada, is_no_prazo, is_fora_prazo, data_extracao,
                           CASE WHEN is_no_prazo = 1 THEN N'NO PRAZO'
                                WHEN is_fora_prazo = 1 THEN N'FORA DO PRAZO'
                                WHEN is_finalizada = 1 THEN N'SEM DADO'
                                ELSE N'EM ABERTO' END AS performance_status
                    FROM entregas WHERE 1 = 1
                """ + ctx.where() + ")\n";
        return new ConsultaEntregas(sql, ctx.params());
    }

    private QueryContext criarContexto(FiltroConsultaDTO filtro) {
        return criarContexto(filtro, escopoFilialService.escopoAtual());
    }

    private QueryContext criarContexto(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        List<String> pagadores = valoresDistintos(filtro.valores("pagadores"));
        int pagadoresVazio = pagadores.isEmpty() ? 1 : 0;
        QueryContext ctx = new QueryContext(new StringBuilder(), new MapSqlParameterSource()
                .addValue("dataInicio", Date.valueOf(filtro.dataInicio()))
                .addValue("dataFim", Date.valueOf(filtro.dataFim().plusDays(1)))
                .addValue("hoje", Date.valueOf(LocalDate.now(ZONE_ID_BRASILIA)))
                .addValue("pagadores", pagadoresVazio == 1 ? List.of("__sem_pagador__") : pagadores)
                .addValue("pagadoresVazio", pagadoresVazio),
                carregarColunasPerformance());

        aplicarEscopo(ctx, escopo);
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "status", "status_norm", filtro.valores("status"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "filiais", "filial_emissora", filtro.valores("filiais"));
        adicionarFiltroChave(ctx.whereBuilder(), ctx.params(), "responsaveis", "responsavel_key", filtro.valores("responsaveis"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "regioesDestino", "regiao_destino", filtro.valores("regioesDestino"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "cidadesDestino", "cidade_destino", filtro.valores("cidadesDestino"));
        adicionarFiltrosTabela(ctx, filtro);
        return ctx;
    }

    private static void adicionarFiltrosTabela(QueryContext ctx, FiltroConsultaDTO filtro) {
        adicionarFiltroTextoQualquer(ctx.whereBuilder(), ctx.params(), "drillResponsavel", filtro.valores("drillResponsavel"), "responsavel_key", "responsavel");
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "drillRegiao", "regiao_destino", filtro.valores("drillRegiao"));
        adicionarBuscaTabela(ctx.whereBuilder(), ctx.params(), filtro.valores("tabelaBusca"));
        adicionarCodigoTabela(ctx.whereBuilder(), ctx.params(), filtro.valores("tabelaCodigo"));
        adicionarStatusTabela(ctx.whereBuilder(), ctx.params(), filtro.valores("tabelaStatus"));
        adicionarTextoTabela(ctx.whereBuilder(), ctx.params(), "tabelaRazaoSocial", List.of("responsavel_regiao_destino", "filial_emissora"), filtro.valores("tabelaRazaoSocial"));
        adicionarTextoTabela(ctx.whereBuilder(), ctx.params(), "tabelaOrigem", List.of("regiao_destino"), filtro.valores("tabelaOrigem"));
        adicionarTextoTabela(ctx.whereBuilder(), ctx.params(), "tabelaDestino", List.of("regiao_destino", "cidade_destino"), filtro.valores("tabelaDestino"));
        adicionarFiltrosColunasTabela(ctx, filtro);
    }

    private static void adicionarBuscaTabela(StringBuilder where, MapSqlParameterSource params, Collection<String> valores) {
        String termo = primeiroNormalizado(valores);
        if (termo == null) {
            return;
        }

        List<String> predicados = new java.util.ArrayList<>();
        Long numero = parseLongOuNulo(termo);
        if (numero != null) {
            params.addValue("filtroTabelaBuscaCodigo", numero);
            predicados.add("numero_minuta = :filtroTabelaBuscaCodigo");
        } else if (termo.length() >= 3) {
            params.addValue("filtroTabelaBuscaTexto", "%" + termo + "%");
            params.addValue("filtroTabelaBuscaPrefixo", termo + "%");
            List<String> colunasTexto = List.of(
                    "status_norm",
                    "responsavel_regiao_destino",
                    "filial_emissora",
                    "regiao_destino",
                    "cidade_destino",
                    performanceStatusSql(),
                    performanceStatusDiasSql(),
                    comprovanteTextoSql()
            );
            predicados.addAll(colunasTexto.stream()
                    .map(coluna -> normalizarSql(coluna) + " LIKE :filtroTabelaBuscaTexto")
                    .toList());
            predicados.add(normalizarSql("numero_minuta") + " LIKE :filtroTabelaBuscaPrefixo");
        }

        if (!predicados.isEmpty()) {
            where.append("\n AND (").append(String.join(" OR ", predicados)).append(")");
        }
    }

    private static void adicionarCodigoTabela(StringBuilder where, MapSqlParameterSource params, Collection<String> valores) {
        String termo = primeiroNormalizado(valores);
        if (termo == null) {
            return;
        }

        Long numero = parseLongOuNulo(termo);
        if (numero != null) {
            params.addValue("filtroTabelaCodigo", numero);
            where.append("\n AND numero_minuta = :filtroTabelaCodigo");
            return;
        }

        if (termo.length() >= 3) {
            params.addValue("filtroTabelaCodigoPrefixo", termo + "%");
            where.append("\n AND ").append(normalizarSql("numero_minuta")).append(" LIKE :filtroTabelaCodigoPrefixo");
        }
    }

    private static void adicionarStatusTabela(StringBuilder where, MapSqlParameterSource params, Collection<String> valores) {
        List<String> normalizados = normalizar(valores);
        if (normalizados.isEmpty()) {
            return;
        }

        params.addValue("filtroTabelaStatus", normalizados);
        where.append("\n AND ").append(normalizarSql("status_norm")).append(" IN (:filtroTabelaStatus)");
    }

    private static void adicionarTextoTabela(
            StringBuilder where,
            MapSqlParameterSource params,
            String nomeParam,
            List<String> colunas,
            Collection<String> valores
    ) {
        String termo = primeiroNormalizado(valores);
        if (termo == null || termo.length() < 3 || colunas.isEmpty()) {
            return;
        }

        String param = "filtro_" + nomeParam;
        params.addValue(param, "%" + termo + "%");
        where.append("\n AND (")
                .append(String.join(" OR ", colunas.stream()
                        .map(coluna -> normalizarSql(coluna) + " LIKE :" + param)
                        .toList()))
                .append(")");
    }

    private static void adicionarFiltrosColunasTabela(QueryContext ctx, FiltroConsultaDTO filtro) {
        for (Map.Entry<String, List<String>> entry : filtro.filtros().entrySet()) {
            String chave = entry.getKey();
            if (!chave.startsWith("tabelaColuna.")) {
                continue;
            }

            String coluna = chave.substring("tabelaColuna.".length());
            adicionarFiltroColunaTabela(ctx.whereBuilder(), ctx.params(), coluna, entry.getValue());
        }
    }

    private static void adicionarFiltroColunaTabela(
            StringBuilder where,
            MapSqlParameterSource params,
            String coluna,
            Collection<String> valores
    ) {
        String param = "filtroTabelaColuna_" + coluna.replaceAll("[^A-Za-z0-9]", "_");
        switch (coluna) {
            case "numeroMinuta" -> adicionarFiltroCodigoColuna(where, params, "numero_minuta", valores, param);
            case "status" -> adicionarFiltroStatusColuna(where, params, "status_norm", valores, param);
            case "performanceStatus" -> adicionarFiltroTextoColuna(where, params, performanceStatusSql(), valores, param);
            case "performanceStatusDias" -> adicionarFiltroTextoColuna(where, params, performanceStatusDiasSql(), valores, param);
            case "performanceDiferencaDias" -> adicionarFiltroNumeroColuna(where, params, "performance_diferenca_dias", valores, param);
            case "dataPrevisaoEntrega" -> adicionarFiltroDataColuna(where, params, "data_previsao_entrega", valores, param);
            case "dataFinalizacao" -> adicionarFiltroDataColuna(where, params, "data_finalizacao", valores, param);
            case "responsavelRegiaoDestino" -> adicionarFiltroTextoColuna(where, params, "responsavel_regiao_destino", valores, param);
            case "filialEmissora" -> adicionarFiltroTextoColuna(where, params, "filial_emissora", valores, param);
            case "regiaoDestino" -> adicionarFiltroTextoColuna(where, params, "regiao_destino", valores, param);
            case "cidadeDestino" -> adicionarFiltroTextoColuna(where, params, "cidade_destino", valores, param);
            case "pesoTaxado" -> adicionarFiltroNumeroColuna(where, params, "peso_taxado", valores, param);
            case "valorNotaFiscal" -> adicionarFiltroNumeroColuna(where, params, "valor_nota_fiscal", valores, param);
            case "comprovanteAnexado" -> adicionarFiltroComprovanteColuna(where, valores);
            default -> {
            }
        }
    }

    private static void adicionarFiltroTextoColuna(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        String termo = primeiroNormalizado(valores);
        if (termo == null || termo.length() < 3) {
            return;
        }

        params.addValue(param, "%" + termo + "%");
        where.append("\n AND ").append(normalizarSql(expressao)).append(" LIKE :").append(param);
    }

    private static void adicionarFiltroStatusColuna(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        List<String> normalizados = normalizar(valores);
        if (normalizados.isEmpty()) {
            return;
        }

        params.addValue(param, normalizados);
        where.append("\n AND ").append(normalizarSql(expressao)).append(" IN (:").append(param).append(")");
    }

    private static void adicionarFiltroCodigoColuna(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        String termo = primeiroNormalizado(valores);
        if (termo == null) {
            return;
        }

        Long numero = parseLongOuNulo(termo);
        if (numero != null) {
            params.addValue(param, numero);
            where.append("\n AND ").append(expressao).append(" = :").append(param);
            return;
        }

        if (termo.length() >= 3) {
            params.addValue(param, termo + "%");
            where.append("\n AND ").append(normalizarSql(expressao)).append(" LIKE :").append(param);
        }
    }

    private static void adicionarFiltroNumeroColuna(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        BigDecimal numero = parseDecimalOuNulo(primeiroValor(valores));
        if (numero == null) {
            return;
        }

        params.addValue(param, numero);
        where.append("\n AND TRY_CONVERT(DECIMAL(19,4), ").append(expressao).append(") = :").append(param);
    }

    private static void adicionarFiltroDataColuna(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        DateRange intervalo = intervaloData(primeiroValor(valores));
        if (intervalo == null) {
            return;
        }

        String inicioParam = param + "Inicio";
        String fimParam = param + "Fim";
        params.addValue(inicioParam, Date.valueOf(intervalo.inicioInclusivo()));
        params.addValue(fimParam, Date.valueOf(intervalo.fimExclusivo()));
        where.append("\n AND ")
                .append(expressao)
                .append(" >= :")
                .append(inicioParam)
                .append(" AND ")
                .append(expressao)
                .append(" < :")
                .append(fimParam);
    }

    private static void adicionarFiltroComprovanteColuna(StringBuilder where, Collection<String> valores) {
        String termo = primeiroNormalizado(valores);
        if (termo == null) {
            return;
        }

        if (List.of("sim", "s", "true", "1").contains(termo)) {
            where.append("\n AND comprovante_anexado = 1");
            return;
        }

        if (List.of("nao", "não", "n", "false", "0").contains(termo)) {
            where.append("\n AND comprovante_anexado = 0");
        }
    }

    private static String performanceStatusSql() {
        return """
                CASE
                    WHEN performance_diferenca_dias IS NULL THEN NULL
                    WHEN performance_diferenca_dias <= 0 THEN N'NO PRAZO'
                    ELSE N'FORA DO PRAZO'
                END
                """;
    }

    private static String performanceStatusDiasSql() {
        return """
                CASE
                    WHEN performance_diferenca_dias IS NULL THEN NULL
                    WHEN performance_diferenca_dias = 0 THEN N'NO PRAZO'
                    WHEN performance_diferenca_dias = 1 THEN N'1 DIA DE ATRASO'
                    WHEN performance_diferenca_dias = 2 THEN N'2 DIAS DE ATRASO'
                    WHEN performance_diferenca_dias = 3 THEN N'3 DIAS DE ATRASO'
                    WHEN performance_diferenca_dias = -1 THEN N'1 DIA ANTES'
                    WHEN performance_diferenca_dias = -2 THEN N'2 DIAS ANTES'
                    WHEN performance_diferenca_dias = -3 THEN N'3 DIAS ANTES'
                    WHEN performance_diferenca_dias > 3 THEN N'ACIMA DE 3 DIAS DE ATRASO'
                    ELSE N'ACIMA DE 3 DIAS ANTES'
                END
                """;
    }

    private static String comprovanteTextoSql() {
        return "CASE WHEN comprovante_anexado = 1 THEN N'Sim' ELSE N'Nao' END";
    }

    private static String normalizarSql(String expressao) {
        return "LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), " + expressao + "))))";
    }

    private static String primeiroNormalizado(Collection<String> valores) {
        return normalizar(valores).stream().findFirst().orElse(null);
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

    private static Long parseLongOuNulo(String valor) {
        if (valor == null || !valor.matches("\\d+")) {
            return null;
        }
        try {
            return Long.parseLong(valor);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static BigDecimal parseDecimalOuNulo(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }

        String texto = valor.trim();
        String normalizado = texto.contains(",")
                ? texto.replace(".", "").replace(",", ".")
                : texto;
        if (!normalizado.matches("-?\\d+(\\.\\d+)?")) {
            return null;
        }

        try {
            return new BigDecimal(normalizado);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static DateRange intervaloData(String valor) {
        String termo = normalizarPrefixoData(valor);
        if (termo == null) {
            return null;
        }

        try {
            if (termo.matches("\\d{4}")) {
                LocalDate inicio = LocalDate.of(Integer.parseInt(termo), 1, 1);
                return new DateRange(inicio, inicio.plusYears(1));
            }

            if (termo.matches("\\d{4}-\\d{2}")) {
                String[] partes = termo.split("-");
                LocalDate inicio = LocalDate.of(Integer.parseInt(partes[0]), Integer.parseInt(partes[1]), 1);
                return new DateRange(inicio, inicio.plusMonths(1));
            }

            LocalDate inicio = LocalDate.parse(termo);
            return new DateRange(inicio, inicio.plusDays(1));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String normalizarPrefixoData(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }

        String texto = valor.trim();
        if (texto.matches("\\d{4}") || texto.matches("\\d{4}-\\d{2}") || texto.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return texto;
        }

        if (texto.matches("\\d{2}/\\d{4}")) {
            String[] partes = texto.split("/");
            return partes[1] + "-" + partes[0];
        }

        if (texto.matches("\\d{2}/\\d{2}/\\d{4}")) {
            String[] partes = texto.split("/");
            return partes[2] + "-" + partes[1] + "-" + partes[0];
        }

        return null;
    }

    private static void aplicarEscopo(QueryContext ctx, EscopoFilialService.EscopoFilial escopo) {
        if (escopo.acessoTotal()) {
            return;
        }
        List<String> filiais = normalizar(escopo.filiaisOrdenadas());
        if (filiais.isEmpty()) {
            ctx.whereBuilder().append("\n AND 1 = 0");
            return;
        }
        ctx.params().addValue("escopoFiliais", filiais);
        ctx.whereBuilder().append("\n AND responsavel_key IN (:escopoFiliais)");
    }

    private static void adicionarFiltroChave(
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
        where.append("\n AND ").append(campo).append(" IN (:").append(chave).append(")");
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
        where.append("\n AND LOWER(").append(campo).append(") IN (:").append(chave).append(")");
    }

    private static void adicionarFiltroTextoQualquer(
            StringBuilder where,
            MapSqlParameterSource params,
            String chave,
            Collection<String> valores,
            String... campos
    ) {
        List<String> normalizados = normalizar(valores);
        if (normalizados.isEmpty() || campos.length == 0) {
            return;
        }
        params.addValue(chave, normalizados);
        where.append("\n AND (");
        for (int i = 0; i < campos.length; i++) {
            if (i > 0) {
                where.append(" OR ");
            }
            where.append("LOWER(").append(campos[i]).append(") IN (:").append(chave).append(")");
        }
        where.append(")");
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

    private static List<String> valoresDistintos(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private static List<String> valorOpcional(String valor) {
        return valor == null || valor.isBlank() ? List.of() : List.of(valor);
    }

    private static String normalizarNivel(String nivel) {
        if (nivel == null || nivel.isBlank()) {
            return "responsavel";
        }
        String valor = nivel.trim().toLowerCase(Locale.ROOT);
        if ("regiao".equals(valor) || "cidade".equals(valor)) {
            return valor;
        }
        return "responsavel";
    }

    private static TemporalQuery temporalQuery(
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
            return new TemporalQuery("DATEFROMPARTS(YEAR(data_previsao_entrega), 1, 1)", "", Map.of());
        }

        if ("mes".equals(nivelSeguro)) {
            if (anoSeguro != null) {
                adicionarIntervaloTemporal(
                        where,
                        parametros,
                        "data_previsao_entrega",
                        "inicioTemporal",
                        "fimTemporal",
                        LocalDate.of(anoSeguro, 1, 1),
                        LocalDate.of(anoSeguro + 1, 1, 1)
                );
            }
            return new TemporalQuery(
                    "DATEFROMPARTS(YEAR(data_previsao_entrega), MONTH(data_previsao_entrega), 1)",
                    where.toString(),
                    parametros
            );
        }

        if (anoSeguro != null && mesSeguro != null) {
            LocalDate inicio = LocalDate.of(anoSeguro, mesSeguro, 1);
            adicionarIntervaloTemporal(
                    where,
                    parametros,
                    "data_previsao_entrega",
                    "inicioTemporal",
                    "fimTemporal",
                    inicio,
                    inicio.plusMonths(1)
            );
        } else if (anoSeguro != null) {
            adicionarIntervaloTemporal(
                    where,
                    parametros,
                    "data_previsao_entrega",
                    "inicioTemporal",
                    "fimTemporal",
                    LocalDate.of(anoSeguro, 1, 1),
                    LocalDate.of(anoSeguro + 1, 1, 1)
            );
        } else if (mesSeguro != null) {
            adicionarIntervalosMensaisPorAno(where, parametros, "data_previsao_entrega", mesSeguro, periodoInicio, periodoFim);
        }

        return new TemporalQuery("data_previsao_entrega", where.toString(), parametros);
    }

    private static void adicionarIntervaloTemporal(
            StringBuilder where,
            Map<String, Object> parametros,
            String coluna,
            String inicioParam,
            String fimParam,
            LocalDate inicio,
            LocalDate fim
    ) {
        parametros.put(inicioParam, Date.valueOf(inicio));
        parametros.put(fimParam, Date.valueOf(fim));
        where.append("\n AND ")
                .append(coluna)
                .append(" >= :")
                .append(inicioParam)
                .append(" AND ")
                .append(coluna)
                .append(" < :")
                .append(fimParam);
    }

    private static void adicionarIntervalosMensaisPorAno(
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
            parametros.put(inicioParam, Date.valueOf(inicio));
            parametros.put(fimParam, Date.valueOf(fim));
            predicados.add("(" + coluna + " >= :" + inicioParam + " AND " + coluna + " < :" + fimParam + ")");
            indice++;
        }
        if (!predicados.isEmpty()) {
            where.append("\n AND (").append(String.join(" OR ", predicados)).append(")");
        }
    }

    private PerformanceViewColumns carregarColunasPerformance() {
        PerformanceViewColumns cached = performanceViewColumns;
        if (cached != null) {
            return cached;
        }

        PerformanceViewColumns carregadas = carregarColunasViewFretes();
        if (carregadas.contratoObrigatorioValido()) {
            performanceViewColumns = carregadas;
        }
        return carregadas;
    }

    private PerformanceViewColumns carregarColunasViewFretes() {
        List<String> nomes = jdbcTemplate.queryForList("""
                SELECT name
                FROM sys.dm_exec_describe_first_result_set(
                    N'SELECT TOP (0) * FROM dbo.vw_fretes_powerbi',
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND is_hidden = 0
                ORDER BY column_ordinal
                """, new MapSqlParameterSource(), String.class);
        return new PerformanceViewColumns(nomes);
    }

    private static String baseCte(PerformanceViewColumns colunas) {
        return baseCte(colunas, false);
    }

    private static String baseCte(PerformanceViewColumns colunas, boolean periodoPorOcorrencia) {
        return baseCte(colunas, periodoPorOcorrencia, false);
    }

    private static String baseCte(PerformanceViewColumns colunas, boolean periodoPorOcorrencia, boolean porCliente) {
        exigirColuna(colunas, "Responsável Região Destino Key");
        String responsavelRegiao = textoNullableSql(colunas, "Responsável pela Região de Destino");
        String filialEmissora = textoNullableSql(colunas, "Filial Emissora", "Filial");
        String responsavelKey = textoNullableColunaSql("Responsável Região Destino Key");
        String regiaoDestino = textoComFallbackSql(colunas, "SEM_REGIAO", "Região Destino", "UF Destino");
        String cidadeDestino = textoComFallbackSql(colunas, "SEM_CIDADE", "Cidade Destino", "Destino");
        String performanceDiferencaDias = inteiroNullableSql(colunas, "Performance Diferença de Dias");
        String finalizacaoPerformance = dataNullableSql(colunas, "Finalização da Performance", "Data de Finalização");
        exigirColuna(colunas, "Comprovante Anexado");
        exigirColuna(colunas, "Tipo Frete");
        exigirColuna(colunas, "CT-e Emissão");
        String comprovanteAnexado = """
                CASE
                    WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(20), [Comprovante Anexado])))) IN (N'SIM', N'TRUE', N'1') THEN 1
                    ELSE 0
                END
                """;

        return """
                WITH fonte AS (
                    SELECT
                        TRY_CONVERT(BIGINT, [Nº Minuta]) AS numero_minuta,
                        [Tipo Frete] AS tipo_frete,
                        [Pagador] AS pagador,
                        [NF] AS notas_fiscais,
                        [UF Destino] AS uf_destino,
                        [Data frete] AS data_frete,
                        COALESCE(prazo_reentrega.data, CAST([Previsão de Entrega] AS date)) AS data_previsao_entrega,
                        CAST([Data de Finalização] AS date) AS data_finalizacao,
                        %s AS data_finalizacao_performance,
                        %s AS responsavel_regiao_destino,
                        %s AS filial_emissora,
                        COALESCE(%s,
                                 %s,
                                 N'SEM_RESPONSAVEL') AS responsavel,
                        %s AS responsavel_key,
                        %s AS regiao_destino,
                        %s AS cidade_destino,
                        TRY_CONVERT(DECIMAL(18, 3), [Kg Taxado]) AS peso_taxado,
                        TRY_CONVERT(DECIMAL(18, 2), [Valor NF]) AS valor_nota_fiscal,
                        %s
                        %s AS comprovante_anexado,
                        CASE
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) IN (N'finished', N'finalizado', N'finalizada', N'delivered', N'entregue') THEN N'Finalizada'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) IN (N'canceled', N'cancelled', N'cancelado', N'cancelada') THEN N'Cancelada'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) IN (N'in_transit', N'em trânsito', N'em transito', N'manifested', N'registrado', N'delivering', N'em entrega', N'in_transfer', N'em transferência', N'em transferencia') THEN N'Em Trânsito'
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) IN (N'occurrence_treatment', N'tratamento de ocorrência', N'tratamento de ocorrencia', N'em tratativa', N'tratativa', N'standby', N'aguardando') THEN N'Em Tratativa'
                            ELSE N'Pendente'
                        END AS status_norm,
                        TRY_CONVERT(datetime2, CONVERT(NVARCHAR(64), [Data de extracao])) AS data_extracao,
                        CASE WHEN prazo_reentrega.data IS NULL THEN %s END AS performance_diferenca_dias_publicada,
                        ROW_NUMBER() OVER (
                            PARTITION BY TRY_CONVERT(BIGINT, [Nº Minuta])
                            ORDER BY
                                CASE WHEN [Data de Finalização] IS NOT NULL THEN 0 ELSE 1 END,
                                TRY_CONVERT(datetime2, CONVERT(NVARCHAR(64), [Data de extracao])) DESC,
                                TRY_CONVERT(BIGINT, [ID]) DESC
                        ) AS rn
                    FROM dbo.vw_fretes_powerbi base_raw
                    OUTER APPLY (
                        SELECT cal.data
                        FROM dbo.dim_calendario cal
                        WHERE base_raw.[Tipo Frete] = N'Redelivery'
                          AND cal.is_dia_util = 1
                          AND cal.data > CAST(base_raw.[CT-e Emissão] AS date)
                        ORDER BY cal.data
                        OFFSET 1 ROW FETCH NEXT 1 ROW ONLY
                    ) prazo_reentrega
                    WHERE TRY_CONVERT(BIGINT, [Nº Minuta]) IS NOT NULL
                      AND ([Tipo Frete] IS NULL OR [Tipo Frete] NOT IN (N'Substitute', N'Complementary'))
                      AND (%s)
                      AND (:pagadoresVazio = 1 OR base_raw.[Pagador] IN (:pagadores))
                      %s
                ),
                minutas AS (
                    SELECT
                        numero_minuta, tipo_frete, data_frete, data_finalizacao_performance, pagador, notas_fiscais, uf_destino,
                        data_previsao_entrega,
                        data_finalizacao,
                        responsavel_regiao_destino,
                        filial_emissora,
                        responsavel,
                        responsavel_key,
                        regiao_destino,
                        cidade_destino,
                        COALESCE(peso_taxado, 0) AS peso_taxado,
                        COALESCE(valor_nota_fiscal, 0) AS valor_nota_fiscal,
                        %s
                        comprovante_anexado,
                        status_norm,
                        data_extracao,
                        COALESCE(
                            performance_diferenca_dias_publicada,
                            CASE
                                WHEN data_finalizacao_performance IS NULL THEN NULL
                                ELSE DATEDIFF(day, data_previsao_entrega, data_finalizacao_performance)
                            END
                        ) AS performance_diferenca_dias
                    FROM fonte
                    WHERE rn = 1
                ),
                entregas AS (
                    SELECT minutas.*,
                           CASE WHEN status_norm = N'Finalizada' THEN 1 ELSE 0 END AS is_finalizada,
                           CASE WHEN status_norm = N'Finalizada' AND performance_diferenca_dias <= 0 THEN 1 ELSE 0 END AS is_no_prazo,
                           CASE WHEN status_norm = N'Finalizada' AND performance_diferenca_dias > 0 THEN 1 ELSE 0 END AS is_fora_prazo
                    FROM minutas
                )
                """.formatted(
                finalizacaoPerformance,
                responsavelRegiao,
                filialEmissora,
                responsavelRegiao,
                filialEmissora,
                responsavelKey,
                regiaoDestino,
                cidadeDestino,
                porCliente ? "[Kg Real] AS peso_real_kg, [Valor Total do Serviço] AS valor_total_servico," : "",
                comprovanteAnexado,
                performanceDiferencaDias,
                periodoPorOcorrencia ? PerformanceOperacaoSql.PERIODO_OCORRENCIA : """
                        (prazo_reentrega.data >= :dataInicio AND prazo_reentrega.data < :dataFim)
                        OR (([Tipo Frete] IS NULL OR [Tipo Frete] <> N'Redelivery' OR [CT-e Emissão] IS NULL)
                          AND [Previsão de Entrega] >= :dataInicio AND [Previsão de Entrega] < :dataFim)
                        """,
                porCliente ? "AND base_raw.[Pagador Doc] IN (:documentos)" : "",
                porCliente ? "peso_real_kg, valor_total_servico, valor_nota_fiscal AS valor_nf_cliente," : ""
        );
    }

    private static void exigirColuna(PerformanceViewColumns colunas, String nome) {
        if (!colunas.existe(nome)) {
            throw new IllegalStateException(
                    "Contrato invalido: dbo.vw_fretes_powerbi.[" + nome
                            + "] ausente. Atualize a view no ETL antes de consumir o KPI de Performance."
            );
        }
    }

    private static String textoNullableSql(PerformanceViewColumns colunas, String... nomes) {
        List<String> expressoes = List.of(nomes).stream()
                .filter(colunas::existe)
                .map(PerformanceDashboardSqlRepository::textoNullableColunaSql)
                .toList();
        if (expressoes.isEmpty()) {
            return "NULL";
        }
        if (expressoes.size() == 1) {
            return expressoes.get(0);
        }
        return "COALESCE(" + String.join(", ", expressoes) + ")";
    }

    private static String textoComFallbackSql(PerformanceViewColumns colunas, String fallback, String... nomes) {
        String texto = textoNullableSql(colunas, nomes);
        return "COALESCE(" + texto + ", N'" + fallback.replace("'", "''") + "')";
    }

    private static String textoNullableColunaSql(String nome) {
        return "NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [" + nome + "]))), '')";
    }

    private static String inteiroNullableSql(PerformanceViewColumns colunas, String... nomes) {
        List<String> expressoes = List.of(nomes).stream()
                .filter(colunas::existe)
                .map(nome -> "TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(64), [" + nome + "]))), N''))")
                .toList();
        if (expressoes.isEmpty()) {
            return "CAST(NULL AS INT)";
        }
        if (expressoes.size() == 1) {
            return expressoes.get(0);
        }
        return "COALESCE(" + String.join(", ", expressoes) + ")";
    }

    private static String dataNullableSql(PerformanceViewColumns colunas, String... nomes) {
        List<String> expressoes = List.of(nomes).stream()
                .filter(colunas::existe)
                .map(nome -> "CAST([" + nome + "] AS date)")
                .toList();
        if (expressoes.isEmpty()) {
            return "CAST(NULL AS date)";
        }
        if (expressoes.size() == 1) {
            return expressoes.get(0);
        }
        return "COALESCE(" + String.join(", ", expressoes) + ")";
    }

    private static String updatedAt(Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        if (valor instanceof Timestamp timestamp) {
            return TemporalJsonUtils.formatarIsoComOffset(timestamp.toLocalDateTime());
        }
        return TemporalJsonUtils.garantirIsoComOffset(valor == null ? null : String.valueOf(valor));
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

    private static Integer inteiroOuNulo(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof Number number) {
            return number.intValue();
        }
        return Integer.valueOf(String.valueOf(valor));
    }

    private static MapSqlParameterSource copiarParams(MapSqlParameterSource params) {
        return new MapSqlParameterSource(params.getValues());
    }

    private record QueryContext(
            StringBuilder whereBuilder,
            MapSqlParameterSource params,
            PerformanceViewColumns colunas
    ) {
        String where() {
            String sql = whereBuilder.toString();
            return sql.isEmpty() ? "" : sql + "\n";
        }

        String baseCte() {
            return PerformanceDashboardSqlRepository.baseCte(colunas);
        }
    }

    private record PerformanceViewColumns(List<String> nomes) {
        boolean existe(String nome) {
            return nomes.contains(nome);
        }

        boolean contratoObrigatorioValido() {
            return existe("Comprovante Anexado")
                    && existe("Responsável Região Destino Key")
                    && existe("Tipo Frete")
                    && existe("CT-e Emissão");
        }
    }

    private record TemporalQuery(String expressaoData, String where, Map<String, Object> parametros) {
    }

    private record DateRange(LocalDate inicioInclusivo, LocalDate fimExclusivo) {
    }
}
