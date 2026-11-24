package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.performance.PerformanceTabelaProjection;
import com.dashboard.api.repository.PerformanceDashboardSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.RowMapper;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PerformanceDashboardSqlRepositoryTest {

    @Test
    void tabelaRetornaPageComPageableDoSpring() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        Page<PerformanceTabelaProjection> pagina = repository.buscarTabela(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 24),
                        Map.of()
                ),
                PageRequest.of(1, 50)
        );

        assertEquals(1, pagina.getNumber());
        assertEquals(50, pagina.getSize());
        assertEquals(0L, pagina.getTotalElements());
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("COUNT_BIG(1)")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("$.fit_d_t_created_at") && sql.contains("AS comprovante_anexado")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("[Performance Diferença de Dias]") && sql.contains("performance_diferenca_dias_publicada")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("[Finalização da Performance]") && sql.contains("data_finalizacao_performance")));
        assertEquals(50L, jdbcTemplate.ultimoParametroLong("offsetTabela"));
        assertEquals(50L, jdbcTemplate.ultimoParametroLong("tamanhoTabela"));
    }

    @Test
    void performanceExigeDataDoFreteMesmoQuandoInventarioTemMarcacao() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate(colunasSemComprovante());
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> repository.buscarTabela(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 24),
                        Map.of()
                ),
                PageRequest.of(0, 20)
        ));

        assertTrue(ex.getMessage().contains("Comprovante de Entrega"));
    }

    @Test
    void performanceNaoAtualizaMetadadosQuandoContratoEstaObsoleto() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate(
                colunasSemComprovante(),
                colunasPadrao()
        );
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        assertThrows(IllegalStateException.class, () -> repository.buscarTabela(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 24),
                        Map.of()
                ),
                PageRequest.of(0, 20)
        ));

        assertEquals(1, jdbcTemplate.consultasColunasView);
        assertTrue(jdbcTemplate.sqls.stream().noneMatch(sql -> sql.contains("sp_refreshview")));
    }

    @Test
    void dimensaoResponsaveisUsaChavePublicadaPeloEtl() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.listarResponsaveis(new FiltroConsultaDTO(
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 24),
                Map.of()
        ));

        String sqlDimensao = jdbcTemplate.sqls.get(jdbcTemplate.sqls.size() - 1);
        assertTrue(sqlDimensao.contains("[Responsável Região Destino Key]"));
        assertTrue(sqlDimensao.contains("[Responsável pela Região de Destino]"));
    }

    private static List<String> colunasSemComprovante() {
        return List.of(
                "Comprovante Anexado",
                "Nº Minuta",
                "Previsão de Entrega",
                "Tipo Frete",
                "CT-e Emissão",
                "Data de Finalização",
                "Finalização da Performance",
                "Performance Diferença de Dias",
                "Responsável pela Região de Destino",
                "Responsável Região Destino Key",
                "Filial Emissora",
                "Kg Taxado",
                "Valor NF",
                "Status",
                "Data de extracao",
                "ID"
        );
    }

    private static List<String> colunasPadrao() {
        List<String> colunas = new ArrayList<>(colunasSemComprovante());
        colunas.add("Metadata");
        return List.copyOf(colunas);
    }

    @Test
    void cartoesTabelaEExportacaoConsultamMesmaDataDoRelatorioDeFretes() {
        var jdbc = new CapturandoNamedParameterJdbcTemplate();
        var repository = new PerformanceDashboardSqlRepository(jdbc, new ValidadorPeriodoService(), escopoTotal());
        var filtro = new FiltroConsultaDTO(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 24),
                Map.of("tabelaColuna.comprovanteAnexado", List.of("Não")));

        repository.buscarOverview(filtro);
        String overview = jdbc.sqls.get(jdbc.sqls.size() - 1);
        assertTrue(overview.contains("status_norm = N'Finalizada' AND comprovante_anexado = 1 THEN 1"));
        assertTrue(overview.contains("status_norm = N'Finalizada' AND comprovante_anexado = 0 THEN valor_nota_fiscal"));
        repository.buscarTabela(filtro, PageRequest.of(0, 20));
        String tabela = jdbc.sqls.get(jdbc.sqls.size() - 1);
        repository.buscarTabelaExportacao(filtro);
        String exportacao = jdbc.sqls.get(jdbc.sqls.size() - 1);

        for (String sql : List.of(overview, tabela, exportacao)) {
            assertTrue(sql.contains("JSON_VALUE(base_raw.[Metadata], '$.fit_d_t_created_at')"));
            assertTrue(sql.contains("TRY_CONVERT(datetimeoffset(7), NULLIF(TRIM("));
            assertTrue(sql.contains("WHERE rn = 1"));
            assertTrue(!sql.contains("[Comprovante Anexado]"));
        }
        assertTrue(tabela.contains("AND comprovante_anexado = 0"));
        assertTrue(exportacao.contains("AND comprovante_anexado = 0"));
    }

    @Test
    void dataPublicadaEmColunaPropriaTemPrioridadeSobreMetadataEInventario() {
        var colunas = new ArrayList<>(colunasPadrao());
        colunas.add("Comprovante de Entrega");
        var jdbc = new CapturandoNamedParameterJdbcTemplate(colunas);
        var repository = new PerformanceDashboardSqlRepository(jdbc, new ValidadorPeriodoService(), escopoTotal());
        repository.buscarOverview(new FiltroConsultaDTO(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 24), Map.of()));

        String sql = jdbc.sqls.get(jdbc.sqls.size() - 1);
        assertTrue(sql.contains("base_raw.[Comprovante de Entrega]"));
        assertTrue(!sql.contains("$.fit_d_t_created_at"));
        assertTrue(!sql.contains("[Comprovante Anexado]"));
    }

    @Test
    void tabelaPaginadaUsaCountEOffsetFetchNoBanco() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.buscarTabelaPaginada(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 24),
                        Map.of()
                ),
                2,
                50
        );

        List<String> consultasDados = jdbcTemplate.sqls.stream()
                .filter(sql -> sql.contains("FROM entregas"))
                .toList();

        assertEquals(2, consultasDados.size());
        assertTrue(consultasDados.get(0).contains("COUNT_BIG(1)"));
        assertTrue(consultasDados.get(1).contains("OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY"));
        assertTrue(consultasDados.get(1).contains("N'SEM_REGIAO'"));
        assertTrue(!consultasDados.get(1).contains("[Região Destino]"));
        assertEquals(50L, jdbcTemplate.ultimoParametroLong("offsetTabela"));
        assertEquals(50L, jdbcTemplate.ultimoParametroLong("tamanhoTabela"));
    }

    @Test
    void tabelaAplicaFiltrosAnaliticosAntesDaPaginacao() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.buscarTabela(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 24),
                        Map.of(
                                "tabelaBusca", List.of("Campinas"),
                                "tabelaStatus", List.of("Finalizada"),
                                "tabelaColuna.numeroMinuta", List.of("123"),
                                "tabelaColuna.cidadeDestino", List.of("Destino")
                        )
                ),
                PageRequest.of(0, 20)
        );

        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("filtroTabelaBuscaTexto")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("filtroTabelaStatus")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("numero_minuta = :filtroTabelaColuna_numeroMinuta")));
        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains("filtroTabelaColuna_cidadeDestino")));
        String sqlTabela = jdbcTemplate.sqls.get(jdbcTemplate.sqls.size() - 1);
        assertTrue(!sqlTabela.contains(":filtroTabelaColuna_numeroMinutaORDER"));
        assertTrue(sqlTabela.contains(":filtroTabelaColuna_numeroMinuta\n"));
        assertEquals(123L, jdbcTemplate.ultimoParametroLong("filtroTabelaColuna_numeroMinuta"));
        assertEquals(0L, jdbcTemplate.ultimoParametroLong("offsetTabela"));
        assertEquals(20L, jdbcTemplate.ultimoParametroLong("tamanhoTabela"));
    }

    @Test
    void tabelaAplicaFiltroDePagadoresNaCteBaseComInSargable() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.buscarTabela(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 24),
                        Map.of("pagadores", List.of("Cliente A", "Cliente B"))
                ),
                PageRequest.of(0, 20)
        );

        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql.contains(
                "AND (:pagadoresVazio = 1 OR base_raw.[Pagador] IN (:pagadores))"
        )));
        assertEquals(0L, jdbcTemplate.ultimoParametroLong("pagadoresVazio"));
        assertEquals(List.of("Cliente A", "Cliente B"), jdbcTemplate.ultimoParametro("pagadores"));
    }

    @Test
    void exportacaoAplicaFiltrosDaTabelaSemPaginar() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.buscarTabelaExportacao(new FiltroConsultaDTO(
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 24),
                Map.of(
                        "pagadores", List.of("Cliente A"),
                        "tabelaBusca", List.of("Campinas"),
                        "tabelaStatus", List.of("Finalizada")
                )
        ));

        String sqlExportacao = jdbcTemplate.sqls.get(jdbcTemplate.sqls.size() - 1);
        assertTrue(sqlExportacao.contains("filtroTabelaBuscaTexto"));
        assertTrue(sqlExportacao.contains("filtroTabelaStatus"));
        assertTrue(sqlExportacao.contains("base_raw.[Pagador] IN (:pagadores)"));
        assertTrue(!sqlExportacao.contains("OFFSET :offsetTabela"));
        assertEquals(List.of("Cliente A"), jdbcTemplate.ultimoParametro("pagadores"));
    }

    @Test
    void serieTemporalAgrupaPorNivelEIncluiStatusEmpilhaveis() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.buscarSerieTemporal(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 5, 15),
                        Map.of()
                ),
                "dia",
                2026,
                5
        );

        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql
                .contains("SUM(CASE WHEN status_norm = N'Em Trânsito'")
                && sql.contains("SUM(CASE WHEN status_norm = N'Pendente'")
                && sql.contains("data_previsao_entrega >= :inicioTemporal")
                && sql.contains("data_previsao_entrega < :fimTemporal\nGROUP BY data_previsao_entrega")));
        assertTrue(jdbcTemplate.sqls.stream().noneMatch(sql -> sql.contains("YEAR(data_previsao_entrega) =")));
        assertTrue(jdbcTemplate.sqls.stream().noneMatch(sql -> sql.contains("MONTH(data_previsao_entrega) =")));
        assertEquals(Date.valueOf(LocalDate.of(2026, 5, 1)), jdbcTemplate.ultimoParametro("inicioTemporal"));
        assertEquals(Date.valueOf(LocalDate.of(2026, 6, 1)), jdbcTemplate.ultimoParametro("fimTemporal"));
    }

    @Test
    void historicoUsaPeriodoRecebidoNaCteBase() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        PerformanceDashboardSqlRepository repository = new PerformanceDashboardSqlRepository(
                jdbcTemplate,
                new ValidadorPeriodoService(),
                escopoTotal()
        );

        repository.buscarHistorico(
                new FiltroConsultaDTO(
                        LocalDate.of(2026, 3, 1),
                        LocalDate.of(2026, 5, 25),
                        Map.of()
                )
        );

        assertTrue(jdbcTemplate.sqls.stream().anyMatch(sql -> sql
                .contains("[Previsão de Entrega] >= :dataInicio")
                && sql.contains("[Previsão de Entrega] < :dataFim")
                && sql.contains("GROUP BY CONVERT(char(7), data_previsao_entrega, 23)")));
        assertTrue(jdbcTemplate.sqls.stream().noneMatch(sql -> sql.contains("TRY_CONVERT(date, CONVERT(NVARCHAR(64), [Previsão de Entrega])) >= :dataInicio")));
        assertEquals(Date.valueOf(LocalDate.of(2026, 3, 1)), jdbcTemplate.ultimoParametro("dataInicio"));
        assertEquals(Date.valueOf(LocalDate.of(2026, 5, 26)), jdbcTemplate.ultimoParametro("dataFim"));
    }

    private static EscopoFilialService escopoTotal() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }

    private static final class CapturandoNamedParameterJdbcTemplate extends NamedParameterJdbcTemplate {
        private final List<String> sqls = new ArrayList<>();
        private SqlParameterSource ultimoParametro;
        private final List<List<String>> colunasViewPorConsulta;
        private int consultasColunasView;

        private CapturandoNamedParameterJdbcTemplate() {
            this(colunasPadrao());
        }

        @SafeVarargs
        private CapturandoNamedParameterJdbcTemplate(List<String>... colunasViewPorConsulta) {
            super(new JdbcTemplate());
            this.colunasViewPorConsulta = List.of(colunasViewPorConsulta);
        }

        @Override
        public <T> T queryForObject(String sql, SqlParameterSource paramSource, Class<T> requiredType) {
            sqls.add(sql);
            ultimoParametro = paramSource;
            if (Long.class.equals(requiredType)) {
                return requiredType.cast(0L);
            }
            return null;
        }

        @Override
        public <T> List<T> queryForList(String sql, SqlParameterSource paramSource, Class<T> elementType) {
            sqls.add(sql);
            ultimoParametro = paramSource;
            int indice = Math.min(consultasColunasView, colunasViewPorConsulta.size() - 1);
            consultasColunasView++;
            return colunasViewPorConsulta.get(indice).stream().map(elementType::cast).toList();
        }

        @Override
        public <T> List<T> query(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            sqls.add(sql);
            ultimoParametro = paramSource;
            return List.of();
        }

        @Override
        public Map<String, Object> queryForMap(String sql, SqlParameterSource paramSource) {
            sqls.add(sql);
            ultimoParametro = paramSource;
            return Map.of();
        }

        private long ultimoParametroLong(String nome) {
            Object valor = ultimoParametro.getValue(nome);
            return valor instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(valor));
        }

        private Object ultimoParametro(String nome) {
            return ultimoParametro.getValue(nome);
        }
    }
}
