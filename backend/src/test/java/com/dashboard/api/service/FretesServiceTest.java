package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.fretes.FretesClienteRankingDTO;
import com.dashboard.api.dto.fretes.FretesGoalSummaryDTO;
import com.dashboard.api.dto.fretes.FretesOverviewDTO;
import com.dashboard.api.dto.fretes.FretesTrendPointDTO;
import com.dashboard.api.repository.VisaoFretesRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mockingDetails;

@ExtendWith(MockitoExtension.class)
class FretesServiceTest {

    private static final ZoneId ZONE_ID_BRASILIA = ZoneId.of("America/Sao_Paulo");

    @Mock
    private VisaoFretesRepository repository;

    private FakeFretesGoalService fretesGoalService;
    private FretesService service;

    @BeforeEach
    void setUp() {
        fretesGoalService = new FakeFretesGoalService();
        service = new FretesService(
                new ValidadorPeriodoService(),
                repository,
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao(),
                fretesGoalService,
                Clock.fixed(Instant.parse("2026-06-08T12:00:00Z"), ZONE_ID_BRASILIA)
        );
    }

    @Test
    void buscarOverviewIncluiCalculosDiariosDeMetaETendencia() {
        LocalDate dataInicio = LocalDate.of(2026, 5, 1);
        LocalDate dataFim = LocalDate.of(2026, 5, 19);
        stubOverview(overview(2, "4830280.00", "4830280.00", 2));
        stubRealizados(List.of(realizado("SPO", "2400000.00"), realizado("REC", "2430280.00")));
        when(repository.buscarResumoDiasPeriodo(dataInicio, dataFim)).thenReturn(periodoDias(19, 13));
        when(repository.contarDiasUteisCalendario(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)))
                .thenReturn(21);
        when(repository.contarDiasUteisCalendario(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 19)))
                .thenReturn(13);
        fretesGoalService.summary = new FretesGoalSummaryDTO(
                "2026-05-01",
                "2026-05-19",
                new BigDecimal("8400000.00"),
                new BigDecimal("4830280.00"),
                57.50,
                List.of()
        );

        FretesOverviewDTO overview = service.buscarOverview(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()));

        assertThat(overview.updatedAt()).isEqualTo("2026-05-19T09:00:00-03:00");
        assertThat(overview.receitaBruta()).isEqualByComparingTo("4830280.00");
        assertThat(overview.totalDiasCivis()).isEqualTo(19);
        assertThat(overview.totalDiasUteis()).isEqualTo(13);
        assertThat(overview.faturamentoDiario().totalDiasUteisMes()).isEqualTo(21);
        assertThat(overview.faturamentoDiario().diasUteisDecorridos()).isEqualTo(13);
        assertThat(overview.faturamentoDiario().diasUteisRestantes()).isEqualTo(8);
        assertThat(overview.faturamentoDiario().metaDiariaBase()).isEqualByComparingTo("400000.00");
        assertThat(overview.faturamentoDiario().faturamentoDiarioReal()).isEqualByComparingTo("371560.00");
        assertThat(overview.faturamentoDiario().metaDiariaDinamica()).isEqualByComparingTo("446215.00");
        assertThat(overview.faturamentoDiario().faturamentoFaltante()).isEqualByComparingTo("3569720.00");
        assertThat(overview.faturamentoDiario().tendenciaFaturamento()).isEqualByComparingTo("7802760.00");
        assertThat(overview.faturamentoDiario().tendenciaPercentual()).isEqualByComparingTo("-0.071100");
    }

    @ParameterizedTest
    @CsvSource({"2,4830280.005", "2,0", "0,99", "2,-15.555"})
    void receitaExecutivaPreservaConsultaFiltrosEValorSemConsultarMetas(int total, String receita) {
        stubOverview(overview(total, receita, receita, total));
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 19),
                Map.of("filiais", List.of("SPO"), "status", List.of("Autorizado"),
                        "pagadores", List.of("Cliente"), "responsaveis", List.of("REC")));
        BigDecimal receitaOriginal = service.buscarOverview(filtro).receitaBruta();
        var consultasOriginais = List.copyOf(mockingDetails(repository).getInvocations());
        Object[] parametrosOriginais = consultasOriginais.stream()
                .filter(i -> i.getMethod().getName().equals("buscarOverviewAgregado"))
                .findFirst().orElseThrow().getArguments();
        assertThat(consultasOriginais.size()).isGreaterThan(1);
        clearInvocations(repository);

        assertThat(service.buscarReceitaBruta(filtro)).isEqualTo(receitaOriginal);
        var consultasNovas = List.copyOf(mockingDetails(repository).getInvocations());
        assertThat(consultasNovas).hasSize(1);
        assertThat(consultasNovas.get(0).getMethod().getName()).isEqualTo("buscarOverviewAgregado");
        assertThat(consultasNovas.get(0).getArguments()).containsExactly(parametrosOriginais);
    }

    @Test
    void buscarOverviewCalculaRunRateComD1EProjetaSobreAcumuladoComD0() {
        service = new FretesService(
                new ValidadorPeriodoService(),
                repository,
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao(),
                fretesGoalService,
                Clock.fixed(Instant.parse("2026-05-19T12:00:00Z"), ZONE_ID_BRASILIA)
        );
        LocalDate dataInicio = LocalDate.of(2026, 5, 1);
        LocalDate dataFim = LocalDate.of(2026, 5, 19);
        when(repository.buscarUltimoDiaUtilFechado(LocalDate.of(2026, 5, 19)))
                .thenReturn(LocalDate.of(2026, 5, 18));
        when(repository.contarDiasUteisCalendario(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)))
                .thenReturn(20);
        when(repository.contarDiasUteisCalendario(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 18)))
                .thenReturn(11);
        when(repository.buscarOverviewAgregado(
                any(), any(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(),
                anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt()
        )).thenReturn(
                overview(10, "5000000.00", "5000000.00", 10),
                overview(9, "4400000.00", "4400000.00", 9)
        );
        stubRealizados(List.of(realizado("SPO", "5000000.00")));
        fretesGoalService.summary = new FretesGoalSummaryDTO(
                "2026-05-01",
                "2026-05-19",
                new BigDecimal("8400000.00"),
                new BigDecimal("5000000.00"),
                59.52,
                List.of()
        );

        FretesOverviewDTO overview = service.buscarOverview(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()));

        assertThat(overview.receitaBruta()).isEqualByComparingTo("5000000.00");
        assertThat(overview.faturamentoDiario().totalDiasUteisMes()).isEqualTo(20);
        assertThat(overview.faturamentoDiario().diasUteisDecorridos()).isEqualTo(11);
        assertThat(overview.faturamentoDiario().diasUteisRestantes()).isEqualTo(9);
        assertThat(overview.faturamentoDiario().faturamentoDiarioReal()).isEqualByComparingTo("400000.00");
        assertThat(overview.faturamentoDiario().faturamentoFaltante()).isEqualByComparingTo("4000000.00");
        assertThat(overview.faturamentoDiario().metaDiariaDinamica()).isEqualByComparingTo("444444.44");
        assertThat(overview.faturamentoDiario().tendenciaFaturamento()).isEqualByComparingTo("8600000.00");
        assertThat(overview.faturamentoDiario().tendenciaPercentual()).isEqualByComparingTo("0.023810");
    }

    @Test
    void buscarOverviewMantemTotalOperacionalEExcluiCortesiasEBloqueiosDoFaturamento() {
        LocalDate dataInicio = LocalDate.of(2026, 5, 1);
        LocalDate dataFim = LocalDate.of(2026, 5, 19);
        stubOverview(overview(3, "100.00", "100.00", 1));
        stubRealizados(List.of(realizado("SPO", "100.00")));

        FretesOverviewDTO overview = service.buscarOverview(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()));

        assertThat(overview.totalFretes()).isEqualTo(3);
        assertThat(overview.receitaBruta()).isEqualByComparingTo("100.00");
        assertThat(overview.valorFrete()).isEqualByComparingTo("100.00");
        assertThat(overview.ticketMedio()).isEqualByComparingTo("100.00");
        assertThat(fretesGoalService.realizadosRecebidos).singleElement().satisfies(realizado -> {
            assertThat(realizado.branchId()).isEqualTo("SPO");
            assertThat(realizado.realizadoFaturamento()).isEqualByComparingTo("100.00");
        });
    }

    @Test
    void buscarSerieTemporalUsaAgregacaoSqlApenasDeFaturamentoElegivel() {
        when(repository.buscarSerieTemporalAgregada(
                any(), any(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(),
                anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt()
        )).thenReturn(List.of(
                trend("2026-04-02", "100.00", "100.00", 1),
                trend("2026-04-03", "50.00", "50.00", 1)
        ));

        List<FretesTrendPointDTO> serie = service.buscarSerieTemporal(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of())
        );

        assertThat(serie).extracting(FretesTrendPointDTO::date).containsExactly("2026-04-02", "2026-04-03");
        assertThat(serie.get(0).receitaBruta()).isEqualByComparingTo("100.00");
        assertThat(serie.get(0).valorFrete()).isEqualByComparingTo("100.00");
        assertThat(serie.get(0).fretes()).isEqualTo(1);
        assertThat(serie.get(1).receitaBruta()).isEqualByComparingTo("50.00");
        assertThat(serie.get(1).valorFrete()).isEqualByComparingTo("50.00");
        assertThat(serie.get(1).fretes()).isEqualTo(1);
    }

    @Test
    void buscarTopClientesPreservaCnpjBaseDoGrupo() {
        when(repository.buscarTopClientesAgregado(
                any(), any(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(),
                anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(),
                anyInt()
        )).thenReturn(List.of(clienteRanking("PPG", "43.996.693", "300.00", 2, "150.00")));

        List<FretesClienteRankingDTO> topClientes = service.buscarTopClientes(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of()),
                10
        );

        assertThat(topClientes).containsExactly(new FretesClienteRankingDTO(
                "PPG",
                "43.996.693",
                new BigDecimal("300.00").setScale(2, RoundingMode.HALF_UP),
                2,
                new BigDecimal("150.00").setScale(2, RoundingMode.HALF_UP)
        ));
    }

    private void stubOverview(VisaoFretesRepository.FretesOverviewProjection overview) {
        when(repository.buscarOverviewAgregado(
                any(), any(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(),
                anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt()
        )).thenReturn(overview);
    }

    private void stubRealizados(List<VisaoFretesRepository.FretesRealizadoFilialProjection> realizados) {
        when(repository.buscarRealizadoFaturamentoPorFilial(
                any(), any(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(),
                anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt(), anyList(), anyInt()
        )).thenReturn(realizados);
    }

    private static VisaoFretesRepository.FretesOverviewProjection overview(
            int total,
            String receita,
            String valorFrete,
            int fretesFaturamento
    ) {
        return new VisaoFretesRepository.FretesOverviewProjection() {
            @Override public LocalDateTime getUpdatedAt() { return LocalDateTime.of(2026, 5, 19, 12, 0); }
            @Override public int getTotalFretes() { return total; }
            @Override public BigDecimal getReceitaBruta() { return new BigDecimal(receita); }
            @Override public BigDecimal getValorFrete() { return new BigDecimal(valorFrete); }
            @Override public int getFretesFaturamento() { return fretesFaturamento; }
            @Override public BigDecimal getPesoTaxadoTotal() { return BigDecimal.ZERO; }
            @Override public int getVolumesTotais() { return total; }
            @Override public int getCteEmitidos() { return 0; }
            @Override public int getNfseEmitidas() { return 0; }
            @Override public int getFretesPrevisaoVencida() { return 0; }
        };
    }

    private static VisaoFretesRepository.PeriodoDiasProjection periodoDias(int civis, int uteis) {
        return new VisaoFretesRepository.PeriodoDiasProjection() {
            @Override public int getTotalDiasCivis() { return civis; }
            @Override public int getTotalDiasUteis() { return uteis; }
        };
    }

    private static VisaoFretesRepository.FretesRealizadoFilialProjection realizado(String filial, String valor) {
        return new VisaoFretesRepository.FretesRealizadoFilialProjection() {
            @Override public String getFilial() { return filial; }
            @Override public BigDecimal getRealizadoFaturamento() { return new BigDecimal(valor); }
        };
    }

    private static VisaoFretesRepository.FretesTrendProjection trend(String date, String receita, String valorFrete, int fretes) {
        return new VisaoFretesRepository.FretesTrendProjection() {
            @Override public String getDate() { return date; }
            @Override public BigDecimal getReceitaBruta() { return new BigDecimal(receita); }
            @Override public BigDecimal getValorFrete() { return new BigDecimal(valorFrete); }
            @Override public int getFretes() { return fretes; }
        };
    }

    private static VisaoFretesRepository.FretesClienteRankingProjection clienteRanking(
            String cliente,
            String cnpjBase,
            String receita,
            int fretes,
            String ticketMedio
    ) {
        return new VisaoFretesRepository.FretesClienteRankingProjection() {
            @Override public String getCliente() { return cliente; }
            @Override public String getCnpjBase() { return cnpjBase; }
            @Override public BigDecimal getReceita() { return new BigDecimal(receita); }
            @Override public int getFretes() { return fretes; }
            @Override public BigDecimal getTicketMedio() { return new BigDecimal(ticketMedio); }
        };
    }

    private static EscopoFilialService escopoSemRestricao() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }

    private static final class FakeFretesGoalService extends FretesGoalService {
        private FretesGoalSummaryDTO summary;
        private List<FretesBranchRealizado> realizadosRecebidos = List.of();

        FakeFretesGoalService() {
            super(null, null);
        }

        @Override
        public FretesGoalSummaryDTO buscarResumo(
                LocalDate dataInicio,
                LocalDate dataFim,
                Collection<FretesBranchRealizado> realizados,
                Collection<String> filiaisSelecionadas
        ) {
            realizadosRecebidos = new ArrayList<>(realizados);
            if (summary != null) {
                return summary;
            }

            BigDecimal realizadoTotal = realizados.stream()
                    .map(FretesBranchRealizado::realizadoFaturamento)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
            return new FretesGoalSummaryDTO(
                    dataInicio.toString(),
                    dataFim.toString(),
                    BigDecimal.ZERO,
                    realizadoTotal,
                    0.0,
                    List.of()
            );
        }
    }
}
