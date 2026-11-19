package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.tracking.TrackingChartsDTO;
import com.dashboard.api.dto.tracking.TrackingDashboardDTO;
import com.dashboard.api.dto.tracking.TrackingOverviewDTO;
import com.dashboard.api.dto.tracking.TrackingPrevisaoVencidaFilialDTO;
import com.dashboard.api.dto.tracking.TrackingTimelinePointDTO;
import com.dashboard.api.repository.TrackingSqlRepository;
import com.dashboard.api.repository.VisaoLocalizacaoCargasRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class TrackingServiceTest {

    @Mock
    private VisaoLocalizacaoCargasRepository repository;

    private TrackingService service;
    private FakeTrackingSqlRepository trackingSqlRepository;

    @BeforeEach
    void setUp() {
        trackingSqlRepository = new FakeTrackingSqlRepository();
        service = new TrackingService(new ValidadorPeriodoService(), repository, trackingSqlRepository);
    }

    @Test
    void buscarOverviewDeveContarStatusNuloComoAbertoNaPrevisaoVencida() {
        trackingSqlRepository.overview = new TrackingOverviewDTO(
                "2026-03-23T12:00:00",
                3,
                2,
                2,
                new BigDecimal("300.00"),
                new BigDecimal("30.00"),
                0.0
        );

        TrackingOverviewDTO overview = service.buscarOverview(filtroPadrao());

        assertThat(trackingSqlRepository.overviewFiltro).isEqualTo(filtroPadrao());
        assertThat(overview.totalCargas()).isEqualTo(3);
        assertThat(overview.emTransito()).isEqualTo(2);
        assertThat(overview.previsaoVencida()).isEqualTo(2);
        assertThat(overview.valorFreteEmCarteira()).isEqualByComparingTo("300.00");
        assertThat(overview.pesoTaxadoTotal()).isEqualByComparingTo("30.00");
        assertThat(overview.pctFinalizado()).isEqualTo(0.0);
    }

    @Test
    void buscarOverviewDeveExpurgarCanceladosDoDenominadorDeFinalizacao() {
        trackingSqlRepository.overview = new TrackingOverviewDTO(
                "2026-03-23T12:00:00",
                4,
                0,
                2,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                33.33
        );

        TrackingOverviewDTO overview = service.buscarOverview(filtroPadrao());

        assertThat(overview.totalCargas()).isEqualTo(4);
        assertThat(overview.previsaoVencida()).isEqualTo(2);
        assertThat(overview.pctFinalizado()).isEqualTo(33.33);
    }

    @Test
    void buscarOverviewDeveConsiderarPrevisaoVencidaPorDataCivilLocal() {
        trackingSqlRepository.overview = new TrackingOverviewDTO(
                "2026-03-23T12:00:00",
                3,
                0,
                1,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                0.0
        );

        TrackingOverviewDTO overview = service.buscarOverview(filtroPadrao());

        assertThat(overview.previsaoVencida()).isEqualTo(1);
    }

    @Test
    void buscarGraficosDeveAgruparPrevisaoVencidaSemFilial() {
        trackingSqlRepository.graficos = new TrackingChartsDTO(
                List.of(),
                List.of(
                        new TrackingPrevisaoVencidaFilialDTO("Sem filial", 2, 2),
                        new TrackingPrevisaoVencidaFilialDTO("Filial SP", 1, 1)
                ),
                List.of()
        );

        TrackingChartsDTO graficos = service.buscarGraficos(filtroPadrao());

        assertThat(trackingSqlRepository.graficosFiltro).isEqualTo(filtroPadrao());
        assertThat(graficos.previsaoVencidaPorFilialAtual()).extracting(
                dto -> dto.filialAtual(),
                dto -> dto.vencidas(),
                dto -> dto.total()
        ).containsExactly(
                org.assertj.core.groups.Tuple.tuple("Sem filial", 2, 2),
                org.assertj.core.groups.Tuple.tuple("Filial SP", 1, 1)
        );
    }

    @Test
    void buscarOverviewDeveConsultarPeriodoNoFusoDeSaoPaulo() {
        trackingSqlRepository.overview = new TrackingOverviewDTO(
                "2026-03-23T12:00:00",
                0,
                0,
                0,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                0.0
        );

        service.buscarOverview(filtroPadrao());

        assertThat(trackingSqlRepository.overviewFiltro).isEqualTo(filtroPadrao());
    }

    @Test
    void deveExigirFilialAtualParaPerfilComAcessoTotal() {
        TrackingService serviceComAcessoTotal = serviceComEscopo(EscopoFilialService.EscopoFilial.comAcessoTotal());

        assertThatThrownBy(() -> serviceComAcessoTotal.normalizarFiltroComFilialAtualObrigatoria(filtroPadrao()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Filial Atual é obrigatória");
    }

    @Test
    void deveAutoselecionarFilialAtualQuandoEscopoTiverUnicaFilial() {
        TrackingService serviceComFilialUnica = serviceComEscopo(
                new EscopoFilialService.EscopoFilial(false, List.of("SPO - RODOGARCIA"))
        );

        FiltroConsultaDTO filtro = serviceComFilialUnica.normalizarFiltroComFilialAtualObrigatoria(filtroPadrao());

        assertThat(filtro.valores("filialAtual")).containsExactly("SPO - RODOGARCIA");
    }

    @Test
    void expansaoRequerRamoSelecionadoEFilialAtual() {
        TrackingService comAcessoTotal = serviceComEscopo(EscopoFilialService.EscopoFilial.comAcessoTotal());
        assertThatThrownBy(() -> comAcessoTotal.buscarFretes(filtroPadrao(), 1, 10))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("siglaResponsavel");
        var apenasSigla = new FiltroConsultaDTO(filtroPadrao().dataInicio(), filtroPadrao().dataFim(),
                Map.of("siglaResponsavel", List.of("AGU")));
        assertThatThrownBy(() -> comAcessoTotal.buscarFretes(apenasSigla, 1, 10))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("regiaoDestino");
        assertThatThrownBy(() -> comAcessoTotal.buscarRegioes(apenasSigla, 1, 10))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Filial Atual");
    }

    @Test
    void buscarDashboardDeveUsarConsultaUnicaSargableDaViewDeTracking() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        TrackingService serviceDashboard = new TrackingService(
                new ValidadorPeriodoService(),
                repository,
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao(),
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao())
        );

        serviceDashboard.buscarDashboard(new FiltroConsultaDTO(
                LocalDate.of(2026, 2, 21),
                LocalDate.of(2026, 3, 23),
                Map.of("filialAtual", List.of("SPO - RODOGARCIA"))
        ));

        String sqlExecutado = String.join("\n", jdbcTemplate.sqls());
        assertThat(sqlExecutado)
                .contains("FROM [vw_localizacao_cargas_powerbi] base_raw")
                .contains("[Status Normalizado]")
                .contains("[Peso Taxado Decimal]")
                .contains("[Valor NF Decimal]")
                .contains("[Sigla Responsável Região Destino]")
                .contains("base_raw.[Data do frete] >= :inicioOffset AND base_raw.[Data do frete] < :fimOffset")
                .contains("[Data do frete] >= :inicioOffset AND [Data do frete] < :fimOffset")
                .contains("base_raw.[Filial Atual] IN (:filtro_filialAtual)")
                .contains("base_raw.[Localização Atual] IN (:filtro_filialAtualCodigos)")
                .contains("[Filial Atual] IN (:filtro_filialAtual)")
                .contains("N'SEM_MAP'")
                .contains("[Responsável pela Região de Destino]")
                .doesNotContain("TRY_CONVERT(datetimeoffset, [Data do frete])")
                .doesNotContain("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), [Filial Atual]))))");
    }

    @Test
    void buscarDashboardDeveAplicarProjecaoNormalizadaNaConsultaUnica() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        TrackingService serviceDashboard = new TrackingService(
                new ValidadorPeriodoService(),
                repository,
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao(),
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao())
        );

        serviceDashboard.buscarDashboard(new FiltroConsultaDTO(
                LocalDate.of(2026, 2, 21),
                LocalDate.of(2026, 3, 23),
                Map.of("filialAtual", List.of("SPO - RODOGARCIA"))
        ));

        String sqlExecutado = String.join("\n", jdbcTemplate.sqls());
        assertThat(sqlExecutado)
                .contains("THEN N'No Armazém'")
                .contains("THEN N'Finalizadas'")
                .contains("WHERE status_painel.valor IS NOT NULL")
                .contains("base_raw.[Data do frete] >= :inicioOffset AND base_raw.[Data do frete] < :fimOffset")
                .contains("base_raw.[Localização Atual] IN (:filtro_filialAtualCodigos)")
                .doesNotContain("WHERE COALESCE(status_calc.status_norm")
                .doesNotContain("COALESCE(LOWER(status_calc.status_carga)")
                .doesNotContain("__TRACKING_BASE_FILTERS__")
                .contains("filial_atual.valor AS [Filial Atual]")
                .contains("base_raw.[Localização Atual]")
                .contains("[Status Carga]")
                .contains("[Data de extracao]")
                .contains("[Valor Frete]")
                .contains("[Volumes]")
                .contains("[Peso Taxado]")
                .contains("[Valor NF]")
                .contains("[Responsável pela Região de Destino]")
                .contains("[Região Destino]")
                .doesNotContain("TRY_CONVERT(datetimeoffset, [Data do frete])")
                .doesNotContain("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), [Filial Atual]))))");
    }

    @Test
    void buscarDashboardDeveAgregarLinhasDaConsultaUnica() {
        FakeTrackingSqlRepository sqlRepository = new FakeTrackingSqlRepository();
        sqlRepository.dashboard = new TrackingDashboardDTO(
                new TrackingOverviewDTO(
                        "2026-05-23T12:00:00",
                        1,
                        0,
                        1,
                        new BigDecimal("150.00"),
                        new BigDecimal("10.50"),
                        0.0
                ),
                List.of(),
                new TrackingChartsDTO(List.of(), List.of(), List.of())
        );
        TrackingService serviceDashboard = new TrackingService(
                new ValidadorPeriodoService(),
                repository,
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao(),
                null,
                null,
                sqlRepository
        );
        TrackingDashboardDTO dashboard = serviceDashboard.buscarDashboard(new FiltroConsultaDTO(
                LocalDate.of(2026, 4, 23),
                LocalDate.of(2026, 5, 23),
                Map.of("filialAtual", List.of("CPQ - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"))
        ));

        assertThat(dashboard).isSameAs(sqlRepository.dashboard);
        assertThat(sqlRepository.dashboardFiltro.valores("filialAtual"))
                .containsExactly("CPQ - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA");
        assertThat(dashboard.overview().totalCargas()).isEqualTo(1);
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 2, 21), LocalDate.of(2026, 3, 23), Map.of());
    }

    private TrackingService serviceComEscopo(EscopoFilialService.EscopoFilial escopo) {
        return new TrackingService(
                new ValidadorPeriodoService(),
                repository,
                new EscopoFilialService(null, null) {
                    @Override
                    public EscopoFilialService.EscopoFilial escopoAtual() {
                        return escopo;
                    }
                },
                PeriodoOffsetDateTimeHelper.padrao(),
                null,
                null
        );
    }

    private EscopoFilialService escopoSemRestricao() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilialService.EscopoFilial escopoAtual() {
                return EscopoFilialService.EscopoFilial.comAcessoTotal();
            }
        };
    }

    private static class CapturandoNamedParameterJdbcTemplate extends NamedParameterJdbcTemplate {
        private final List<String> sqls = new ArrayList<>();
        private final List<String> colunas;
        private final List<Map<String, Object>> linhas;

        protected CapturandoNamedParameterJdbcTemplate() {
            this(List.of(
                    "Status Normalizado",
                    "Peso Taxado Decimal",
                    "Valor NF Decimal",
                    "Sigla Responsável Região Destino",
                    "Status Carga",
                    "Peso Taxado",
                    "Valor NF",
                    "Responsável pela Região de Destino",
                    "Região Destino"
            ), List.of());
        }

        protected CapturandoNamedParameterJdbcTemplate(List<String> colunas, List<Map<String, Object>> linhas) {
            super(new JdbcTemplate());
            this.colunas = colunas;
            this.linhas = linhas;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> List<T> queryForList(String sql, SqlParameterSource paramSource, Class<T> elementType) {
            sqls.add(sql);
            return (List<T>) colunas;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T queryForObject(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            sqls.add(sql);
            return (T) new TrackingOverviewDTO(
                    "2026-03-23T12:00:00",
                    0,
                    0,
                    0,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    0.0
            );
        }

        @Override
       public <T> List<T> query(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            sqls.add(sql);
            return List.of();
        }

        @Override
       public List<Map<String, Object>> queryForList(String sql, SqlParameterSource paramSource) {
            sqls.add(sql);
            return linhas;
        }

        private List<String> sqls() {
            return sqls;
        }
    }

    private static final class FakeTrackingSqlRepository extends TrackingSqlRepository {
        private FiltroConsultaDTO overviewFiltro;
        private FiltroConsultaDTO graficosFiltro;
        private FiltroConsultaDTO dashboardFiltro;
        private TrackingOverviewDTO overview = new TrackingOverviewDTO(
                "2026-03-23T12:00:00",
                0,
                0,
                0,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                0.0
        );
        private List<TrackingTimelinePointDTO> serie = List.of();
        private TrackingChartsDTO graficos = new TrackingChartsDTO(List.of(), List.of(), List.of());
        private TrackingDashboardDTO dashboard = new TrackingDashboardDTO(overview, List.of(), graficos);

        private FakeTrackingSqlRepository() {
            super(null, null, null, null);
        }

        @Override
        public TrackingOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
            this.overviewFiltro = filtro;
            return overview;
        }

        @Override
        public List<TrackingTimelinePointDTO> buscarSerie(FiltroConsultaDTO filtro) {
            return serie;
        }

        @Override
        public TrackingChartsDTO buscarGraficos(FiltroConsultaDTO filtro) {
            this.graficosFiltro = filtro;
            return graficos;
        }

        @Override
        public TrackingDashboardDTO buscarDashboardConsultaUnica(FiltroConsultaDTO filtro) {
            this.dashboardFiltro = filtro;
            return dashboard;
        }
    }

}
