package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.model.VisaoHorariosCorteEntity;
import com.dashboard.api.repository.HorariosCorteRasterSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HorariosCorteRasterSqlRepositoryTest {

    @Test
    void materializaAsRotasDoPeriodoAntesDeCruzarComApoioEFiliais() throws ReflectiveOperationException {
        for (String consulta : List.of(sql(), sqlSerie(), sqlCount(), constanteSql("SQL_OVERVIEW"), constanteSql("SQL_PAGINA"))) {
            assertThat(consulta).containsSubsequence("SET NOCOUNT ON", "DECLARE @rotas TABLE", "FROM dbo.raster_viagens",
                    "LEFT HASH JOIN paradas", "INSERT INTO @rotas", "FROM rota_canonica;", "FROM @rotas rc",
                    "LEFT JOIN hc_apoio", "LEFT JOIN filiais_raster");
        }
    }

    @Test
    void paginaPreenchidaLeConteudoETotalNaMesmaConsulta() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet linha = mock(ResultSet.class);
        when(linha.getLong("id")).thenReturn(42L);
        when(linha.getLong("total_filtrado")).thenReturn(11L);
        doAnswer(chamada -> {
            RowMapper<?> mapper = chamada.getArgument(1);
            return List.of(mapper.mapRow(linha, 0));
        }).when(jdbc).query(any(PreparedStatementCreator.class), any(RowMapper.class));

        var pagina = buscarPagina(jdbc, 2);
        assertThat(pagina.totalElementos()).isEqualTo(11);
        assertThat(pagina.totalPaginas()).isEqualTo(2);
        assertThat(pagina.conteudo()).hasSize(1);
        verify(jdbc).query(any(PreparedStatementCreator.class), any(RowMapper.class));
    }

    @Test
    void preservaOTotalQuandoAPaginaSolicitadaEstaAlemDoFim() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(any(PreparedStatementCreator.class), any(RowMapper.class)))
                .thenReturn(List.of(), List.of(11L));

        var pagina = buscarPagina(jdbc, 3);
        assertThat(pagina.conteudo()).isEmpty();
        assertThat(pagina.totalElementos()).isEqualTo(11);
        assertThat(pagina.totalPaginas()).isEqualTo(2);
        verify(jdbc, times(2)).query(any(PreparedStatementCreator.class), any(RowMapper.class));
    }

    private PaginaDTO<VisaoHorariosCorteEntity> buscarPagina(JdbcTemplate jdbc, int pagina) {
        LocalDate dia = LocalDate.of(2026, 11, 1);
        return new HorariosCorteRasterSqlRepository(jdbc).findPageByDataBetween(dia, dia,
                EscopoFilialService.EscopoFilial.comAcessoTotal(), List.of(), null, pagina, 10);
    }

    @Test
    void queryDeveFiltrarJanelaDaSmComPredicadosSargaveis() throws ReflectiveOperationException {
        String sql = sql();

        assertThat(sql).contains("v.data_hora_prev_ini AS inicio_referencia", "v.data_hora_real_ini AS inicio_referencia");
        assertThat(sql).contains("WHERE v.data_hora_prev_ini >= :dataInicio");
        assertThat(sql).contains("AND v.data_hora_prev_ini < :dataFimExclusivo");
        assertThat(sql).contains("WHERE v.data_hora_prev_ini IS NULL");
        assertThat(sql).contains("AND v.data_hora_real_ini >= :dataInicio");
        assertThat(sql).contains("AND v.data_hora_real_ini < :dataFimExclusivo");
        assertThat(sql).doesNotContain("WHERE COALESCE(v.data_hora_prev_ini, v.data_hora_real_ini)");
        assertThat(sql).doesNotContain("CAST(? AS DATE)");
        assertThat(sql).contains("N'E. South America Standard Time'",
                "CAST(v.inicio_referencia AT TIME ZONE @fusoRaster AS DATETIME2(7)) AS data_base_sm_at",
                "CAST(v.data_hora_real_ini AT TIME ZONE @fusoRaster AS DATETIME2(7))",
                "CAST(rc.data_base_sm_at AS DATE) AS data_corte", "CAST(CAST(rc.data_base_sm_at AS DATE) AS DATETIME2(0))");
        assertThat(sql).doesNotContain("data_corte_base_at");
    }

    @Test
    void preservaAHoraLocalDaSmNoDetalhamentoPaginado() throws ReflectiveOperationException {
        var pagina = constanteSql("SQL_PAGINA");
        assertThat(pagina).containsSubsequence("data_base_sm_at DATETIME2(7)",
                "CAST(v.inicio_referencia AT TIME ZONE @fusoRaster AS DATETIME2(7)) AS data_base_sm_at",
                "INSERT INTO @rotas", "destino_sm, data_base_sm_at", "destino_sm, data_base_sm_at",
                "CAST(rc.data_base_sm_at AS DATE) AS data_corte", "CAST(data_base_sm_at AS TIME(7)) AS sm_gerada");
    }

    @Test
    void outubroComecaETerminaAMeiaNoiteDeSaoPaulo() throws ReflectiveOperationException {
        var filtro = new FiltroConsultaDTO(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), Map.of());
        var parametros = queryParams(tabelaQuery(sqlCount(), filtro, ""));
        assertThat(parametros.getValue("dataInicio")).isEqualTo(OffsetDateTime.parse("2026-10-01T00:00:00-03:00"));
        assertThat(parametros.getValue("dataFimExclusivo")).isEqualTo(OffsetDateTime.parse("2026-11-01T00:00:00-03:00"));
        var jdbc = new NamedParameterJdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:;MODE=MSSQLServer"));
        var viagens = jdbc.queryForList("""
                SELECT sm FROM (VALUES
                    (9808810, '2026-09-30 23:00:00-03:00'),
                    (1,       '2026-10-01 03:00:00+00:00'),
                    (10027980,'2026-10-31 23:19:47-03:00'),
                    (2,       '2026-11-01 02:59:59.9999999+00:00'),
                    (3,       '2026-11-01 00:00:00-03:00')
                ) AS viagens(sm, inicio)
                WHERE CAST(inicio AS TIMESTAMP(7) WITH TIME ZONE) >= :dataInicio
                  AND CAST(inicio AS TIMESTAMP(7) WITH TIME ZONE) < :dataFimExclusivo
                ORDER BY sm
                """, parametros, Integer.class);
        assertThat(viagens).containsExactly(1, 2, 10027980);
    }

    @Test
    void queryDeveCompararSaidaEfetivaComHorarioCorteCorrigido() throws ReflectiveOperationException {
        String sql = sql();

        assertThat(sql).contains("data_hora_real_ini_at AS saida_efetiva");
        assertThat(sql).contains("WHEN data_hora_real_ini_at IS NULL OR corte_at IS NULL THEN NULL");
        assertThat(sql).contains("WHEN data_hora_real_ini_at <= DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at) THEN CAST(1 AS BIT)");
        assertThat(sql).contains("WHEN data_hora_real_ini_at <= DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at) THEN 0");
        assertThat(sql).contains("ELSE DATEDIFF(MINUTE, DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at), data_hora_real_ini_at)");
    }

    @Test
    void queryDeveAplicarCorteDe22HorasSomenteNaRotaCwbNhb() throws ReflectiveOperationException {
        String sql = sql();

        assertThat(sql).contains("(N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB', CAST(N'22:00:00' AS TIME(0)))");
        assertThat(sql).doesNotContain("(N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB', CAST(N'18:00:00' AS TIME(0)))");
        assertThat(sql).contains("(N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB', N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', CAST(N'04:00:00' AS TIME(0)))");
    }

    @Test
    void queryDeveAplicarCorteDe22HorasNaRotaRjrSpo() throws ReflectiveOperationException {
        String sql = sql();

        assertThat(sql).contains("(N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'22:00:00' AS TIME(0)))");
        assertThat(sql).doesNotContain("(N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'05:00:00' AS TIME(0)))");
        assertThat(sql).contains("(N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR', CAST(N'23:30:00' AS TIME(0)))");
    }

    @Test
    void queryDeveForcarNoPrazoQuandoSmTemJustificativa() throws ReflectiveOperationException {
        String sql = sql();
        String sqlSerie = sqlSerie();

        assertThat(sql).contains("LEFT JOIN dbo.viagem_justificativas vj");
        assertThat(sql).contains("ON rc.cod_solicitacao = vj.cod_solicitacao");
        assertThat(sql).contains("AND vj.ativo = 1");
        assertThat(sql).contains("vj.cod_solicitacao AS cod_solicitacao_justificada");
        assertThat(sql).contains("vj.justificativa AS justificativa");
        assertThat(sql).contains("justificativa AS justificativa");
        assertThat(sql).contains("WHEN cod_solicitacao_justificada IS NOT NULL THEN CAST(1 AS BIT)");
        assertThat(sql).contains("WHEN cod_solicitacao_justificada IS NOT NULL THEN 0");
        assertThat(sqlSerie).contains("WHEN cod_solicitacao_justificada IS NOT NULL THEN 1");
    }

    @Test
    void serieDeveAgruparKpiNoSqlServer() throws ReflectiveOperationException {
        String sql = sqlSerie();

        assertThat(sql).contains("COUNT_BIG(1) AS total_programado");
        assertThat(sql).contains("SUM(CASE WHEN saiu_no_horario = 1 THEN 1 ELSE 0 END)");
        assertThat(sql).contains("SUM(CASE WHEN saiu_no_horario = 0 THEN 1 ELSE 0 END)");
        assertThat(sql).contains("GROUP BY data_corte, filial");
        assertThat(sql).contains("ORDER BY data_corte, filial");
    }

    @Test
    void tabelaPaginadaDeveAplicarFiltrosAnaliticosAntesDoCountEOffset() throws ReflectiveOperationException {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 12),
                Map.of(
                        "tabelaBusca", List.of("Raster"),
                        "tabelaColuna.filial", List.of("CWB"),
                        "tabelaColuna.linhaOuOperacao", List.of("CWB"),
                        "tabelaColuna.saiuNoHorario", List.of("NO PRAZO")
                )
        );

        Object countQuery = tabelaQuery(sqlCount(), filtro, "");
        String sqlCount = querySql(countQuery);
        MapSqlParameterSource countParams = queryParams(countQuery);

        assertThat(sqlCount)
                .contains("SELECT COUNT_BIG(1) FROM calculado")
                .contains("filial_key LIKE :filtroTabelaColuna_filial")
                .contains("filtroTabelaColuna_linhaOuOperacao")
                .contains("IN (:filtroTabelaColuna_saiuNoHorario)")
                .doesNotContain("OFFSET :offset");
        assertThat(countParams.getValue("filtroTabelaBusca")).isEqualTo("%raster%");
        assertThat(countParams.getValue("filtroTabelaColuna_filial")).isEqualTo("%cwb%");
        assertThat(countParams.getValue("filtroTabelaColuna_linhaOuOperacao")).isEqualTo("%cwb%");
        assertThat(countParams.getValue("filtroTabelaColuna_saiuNoHorario")).isEqualTo(List.of("no prazo"));

        Object pageQuery = tabelaQuery(constanteSql("SQL_PAGINA"), filtro, sqlOrderPaged());
        assertThat(querySql(pageQuery))
                .contains("filial_key LIKE :filtroTabelaColuna_filial")
                .contains("COUNT_BIG(*) OVER () AS total_filtrado")
                .contains("ORDER BY data DESC, importado_em DESC, filial, linha_ou_operacao, id")
                .contains("OFFSET :offset ROWS FETCH NEXT :limite ROWS ONLY");
    }

    @Test
    void regraCorrigidaDeveMarcarAtrasoQuandoFimPrevistoCaiNoDiaSeguinte() {
        LocalDateTime dataBaseSm = LocalDateTime.of(2026, 5, 20, 23, 10);
        LocalDateTime saidaEfetiva = LocalDateTime.of(2026, 5, 21, 0, 10);
        LocalDateTime previsaoChegadaDiaSeguinte = LocalDateTime.of(2026, 5, 21, 5, 0);
        LocalTime cortePrevistoRota = LocalTime.of(23, 30);

        LocalDateTime horarioCorteCorrigido = dataBaseSm.toLocalDate().atTime(cortePrevistoRota);
        LocalDateTime horarioCorteAntigo = previsaoChegadaDiaSeguinte.toLocalDate().atTime(cortePrevistoRota);

        assertThat(saidaEfetiva.compareTo(horarioCorteCorrigido) <= 0).isFalse();
        assertThat(saidaEfetiva.compareTo(horarioCorteAntigo) <= 0).isTrue();
    }

    @Test
    void regraDeToleranciaDeveAceitarAteDezMinutosAposCorte() throws ReflectiveOperationException {
        int toleranciaMinutos = toleranciaHorarioCorteMinutos();
        LocalDateTime horarioCorte = LocalDateTime.of(2026, 6, 5, 22, 0);
        LocalDateTime saidaDentroTolerancia = LocalDateTime.of(2026, 6, 5, 22, 10);
        LocalDateTime saidaForaTolerancia = LocalDateTime.of(2026, 6, 5, 22, 11);
        LocalDateTime limiteComTolerancia = horarioCorte.plusMinutes(toleranciaMinutos);

        assertThat(toleranciaMinutos).isEqualTo(10);
        assertThat(saidaDentroTolerancia.compareTo(limiteComTolerancia) <= 0).isTrue();
        assertThat(saidaForaTolerancia.compareTo(limiteComTolerancia) <= 0).isFalse();
    }

    private String sql() throws ReflectiveOperationException {
        Field field = HorariosCorteRasterSqlRepository.class.getDeclaredField("SQL");
        field.setAccessible(true);
        return (String) field.get(null);
    }

    private String sqlSerie() throws ReflectiveOperationException {
        Field field = HorariosCorteRasterSqlRepository.class.getDeclaredField("SQL_SERIE");
        field.setAccessible(true);
        return (String) field.get(null);
    }

    private String sqlCount() throws ReflectiveOperationException {
        return constanteSql("SQL_COUNT");
    }

    private String sqlOrderPaged() throws ReflectiveOperationException {
        return constanteSql("SQL_ORDER_PAGED");
    }

    private String constanteSql(String nome) throws ReflectiveOperationException {
        Field field = HorariosCorteRasterSqlRepository.class.getDeclaredField(nome);
        field.setAccessible(true);
        return (String) field.get(null);
    }

    private Object tabelaQuery(String sqlBase, FiltroConsultaDTO filtro, String sufixo) throws ReflectiveOperationException {
        HorariosCorteRasterSqlRepository repository = new HorariosCorteRasterSqlRepository(new JdbcTemplate());
        Method method = HorariosCorteRasterSqlRepository.class.getDeclaredMethod(
                "tabelaQuery",
                String.class,
                LocalDate.class,
                LocalDate.class,
                EscopoFilialService.EscopoFilial.class,
                List.class,
                FiltroConsultaDTO.class,
                String.class
        );
        method.setAccessible(true);
        return method.invoke(
                repository,
                sqlBase,
                filtro.dataInicio(),
                filtro.dataFim(),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                List.of("CWB"),
                filtro,
                sufixo
        );
    }

    private String querySql(Object query) throws ReflectiveOperationException {
        Method method = query.getClass().getDeclaredMethod("sql");
        method.setAccessible(true);
        return (String) method.invoke(query);
    }

    private MapSqlParameterSource queryParams(Object query) throws ReflectiveOperationException {
        Method method = query.getClass().getDeclaredMethod("params");
        method.setAccessible(true);
        return (MapSqlParameterSource) method.invoke(query);
    }

    private int toleranciaHorarioCorteMinutos() throws ReflectiveOperationException {
        Field field = HorariosCorteRasterSqlRepository.class.getDeclaredField("TOLERANCIA_HORARIO_CORTE_MINUTOS");
        field.setAccessible(true);
        return (int) field.get(null);
    }
}
