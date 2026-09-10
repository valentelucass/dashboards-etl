package com.dashboard.api.service;

import com.dashboard.api.contract.ColetasViewContractValidator;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.coletas.ColetasAgingBucketDTO;
import com.dashboard.api.dto.coletas.ColetasCidadeOrigemDTO;
import com.dashboard.api.dto.coletas.ColetasHistoricoPerformanceDTO;
import com.dashboard.api.dto.coletas.ColetasHistoricoPeriodo;
import com.dashboard.api.dto.coletas.ColetasOverviewDTO;
import com.dashboard.api.dto.coletas.ColetasRegiaoOrigemDTO;
import com.dashboard.api.dto.coletas.ColetasStatusDistribuicaoDTO;
import com.dashboard.api.dto.coletas.ColetasTrendPointDTO;
import com.dashboard.api.repository.ColetasAgregadosSqlRepository;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ColetasServiceTest {

    @Test
    void statusDaPrimeiraLinhaNaoDeveEsperarConsultasDaOperacao() {
        LocalDate hoje = LocalDate.of(2026, 9, 10);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(hoje.minusDays(9), hoje, Map.of("filiais", List.of("SPO")));
        CapturingColetasRepository repository = new CapturingColetasRepository();
        ColetasService service = new ColetasService(new ValidadorPeriodoService(), new FixedPeriodoHelper(hoje),
                repository, new NoopColetasViewContractValidator(), null);

        service.buscarStatusDistribuicao(filtro);

        assertThat(repository.statusFiltro).isSameAs(filtro);
        assertThat(repository.regioesFiltro).isNull();
        assertThat(repository.agingFiltro).isNull();
        assertThat(repository.historicoFiltro).isNull();
    }

    @Test
    void operacaoNaoDeveRepetirConsultaDeStatusNemAlterarFiltrosOuDataReferencia() {
        LocalDate hoje = LocalDate.of(2026, 9, 10);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(hoje.minusDays(9), hoje, Map.of("filiais", List.of("SPO")));
        CapturingColetasRepository repository = new CapturingColetasRepository();
        ColetasService service = new ColetasService(new ValidadorPeriodoService(), new FixedPeriodoHelper(hoje),
                repository, new NoopColetasViewContractValidator(), null);

        service.buscarOperacao(filtro);

        assertThat(repository.statusFiltro).isNull();
        assertThat(repository.regioesFiltro).isSameAs(filtro);
        assertThat(repository.agingFiltro).isSameAs(filtro);
        assertThat(repository.agingDataReferencia).isEqualTo(hoje);
        assertThat(repository.historicoFiltro).isNull();
    }

    @Test
    void buscarGraficosNaoDeveAcionarHistoricoPerformance() {
        LocalDate hoje = LocalDate.of(2026, 6, 18);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 6, 1),
                hoje,
                Map.of("filiais", List.of("SPO"))
        );
        CapturingColetasRepository repository = new CapturingColetasRepository();

        ColetasService service = new ColetasService(
                new ValidadorPeriodoService(),
                new FixedPeriodoHelper(hoje),
                repository,
                new NoopColetasViewContractValidator(),
                null
        );

        service.buscarGraficos(filtro);

        assertThat(repository.statusFiltro).isSameAs(filtro);
        assertThat(repository.regioesFiltro).isSameAs(filtro);
        assertThat(repository.agingFiltro).isSameAs(filtro);
        assertThat(repository.agingDataReferencia).isEqualTo(hoje);
        assertThat(repository.historicoFiltro).isNull();
        assertThat(repository.historicoPeriodo).isNull();
        assertThat(repository.historicoDataInicio).isNull();
        assertThat(repository.historicoDataFim).isNull();
    }

    @Test
    void buscarHistoricoPerformanceMensalDeveUsarJanelaPropriaSemAlterarFiltroGlobal() {
        LocalDate hoje = LocalDate.of(2026, 6, 18);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 6, 1),
                hoje,
                Map.of("filiais", List.of("SPO"))
        );
        CapturingColetasRepository repository = new CapturingColetasRepository();

        ColetasService service = new ColetasService(
                new ValidadorPeriodoService(),
                new FixedPeriodoHelper(hoje),
                repository,
                new NoopColetasViewContractValidator(),
                null
        );

        service.buscarHistoricoPerformance(filtro, "6meses");

        assertThat(repository.statusFiltro).isNull();
        assertThat(repository.regioesFiltro).isNull();
        assertThat(repository.agingFiltro).isNull();
        assertThat(repository.historicoFiltro).isSameAs(filtro);
        assertThat(repository.historicoPeriodo).isEqualTo(ColetasHistoricoPeriodo.SEIS_MESES);
        assertThat(repository.historicoDataInicio).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(repository.historicoDataFim).isEqualTo(hoje);
    }

    private static final class FixedPeriodoHelper extends PeriodoOffsetDateTimeHelper {
        private final LocalDate hoje;

        private FixedPeriodoHelper(LocalDate hoje) {
            super(ZoneId.of(PeriodoOffsetDateTimeHelper.DEFAULT_ZONE_ID));
            this.hoje = hoje;
        }

        @Override
        public LocalDate hoje() {
            return hoje;
        }
    }

    private static final class NoopColetasViewContractValidator extends ColetasViewContractValidator {
        private NoopColetasViewContractValidator() {
            super(null);
        }

        @Override
        public void validarSolicitacaoNativa() {
        }
    }

    private static final class CapturingColetasRepository extends ColetasAgregadosSqlRepository {
        private FiltroConsultaDTO statusFiltro;
        private FiltroConsultaDTO historicoFiltro;
        private ColetasHistoricoPeriodo historicoPeriodo;
        private LocalDate historicoDataInicio;
        private LocalDate historicoDataFim;
        private FiltroConsultaDTO regioesFiltro;
        private FiltroConsultaDTO agingFiltro;
        private LocalDate agingDataReferencia;

        private CapturingColetasRepository() {
            super(null, null, null);
        }

        @Override
        public ColetasOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<ColetasTrendPointDTO> buscarSerieTemporal(FiltroConsultaDTO filtro) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<ColetasStatusDistribuicaoDTO> buscarStatusDistribuicao(FiltroConsultaDTO filtro) {
            this.statusFiltro = filtro;
            return List.of();
        }

        @Override
        public List<ColetasHistoricoPerformanceDTO> buscarHistoricoPerformance(
                FiltroConsultaDTO filtro,
                ColetasHistoricoPeriodo periodo,
                LocalDate historicoDataInicio,
                LocalDate historicoDataFim
        ) {
            this.historicoFiltro = filtro;
            this.historicoPeriodo = periodo;
            this.historicoDataInicio = historicoDataInicio;
            this.historicoDataFim = historicoDataFim;
            return List.of();
        }

        @Override
        public List<ColetasRegiaoOrigemDTO> buscarRegioesOrigem(FiltroConsultaDTO filtro) {
            this.regioesFiltro = filtro;
            return List.of();
        }

        @Override
        public List<ColetasCidadeOrigemDTO> buscarCidadesOrigem(FiltroConsultaDTO filtro, String regiao) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<ColetasAgingBucketDTO> buscarAgingAbertas(FiltroConsultaDTO filtro, LocalDate dataReferencia) {
            this.agingFiltro = filtro;
            this.agingDataReferencia = dataReferencia;
            return List.of();
        }
    }
}
