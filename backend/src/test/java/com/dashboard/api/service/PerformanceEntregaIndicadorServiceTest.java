package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.indicadoresgestao.NivelVisaoPerformance;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaOverviewDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaRowDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaSeriePointDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.repository.IndicadoresGestaoAVistaSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PerformanceEntregaIndicadorServiceTest {

    private FakeIndicadoresGestaoAVistaSqlRepository sqlRepository;
    private PerformanceEntregaIndicadorService service;

    @BeforeEach
    void setUp() {
        sqlRepository = new FakeIndicadoresGestaoAVistaSqlRepository();
        service = new PerformanceEntregaIndicadorService(
                new ValidadorPeriodoService(),
                sqlRepository,
                escopoSemRestricao()
        );
    }

    @Test
    void buscarOverviewDeveMapearResumoAgregadoSemCarregarFretes() {
        FiltroConsultaDTO filtro = filtroPadrao();
        sqlRepository.performanceResumo = new IndicadoresGestaoAVistaSqlRepository.PerformanceEntregaResumo(
                "2026-04-03T09:00:00",
                4,
                3,
                2,
                1
        );

        PerformanceEntregaOverviewDTO overview = service.buscarOverview(filtro);

        assertThat(overview.updatedAt()).isEqualTo("2026-04-03T09:00:00-03:00");
        assertThat(overview.totalEntregas()).isEqualTo(4);
        assertThat(overview.entregasNoPrazo()).isEqualTo(2);
        assertThat(overview.entregasForaDoPrazo()).isEqualTo(1);
        assertThat(overview.pctNoPrazo()).isEqualTo(66.67);
    }

    @Test
    void buscarSerieDeveRetornarPontosAgregadosPeloSql() {
        FiltroConsultaDTO filtro = filtroPadrao();
        PerformanceEntregaSeriePointDTO ponto = new PerformanceEntregaSeriePointDTO(
                "REC",
                "REC",
                NivelVisaoPerformance.RESPONSAVEL,
                1,
                1,
                1,
                0,
                100.0
        );
        sqlRepository.performanceSerie = List.of(ponto);

        assertThat(service.buscarSerie(filtro, NivelVisaoPerformance.RESPONSAVEL, null, null)).containsExactly(ponto);
    }

    @Test
    void buscarSerieDeveExigirResponsavelParaVisaoDeRegiao() {
        assertThatThrownBy(() -> service.buscarSerie(filtroPadrao(), NivelVisaoPerformance.REGIAO, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("responsavelFiltro");
    }

    @Test
    void buscarTabelaPaginadaDeveUsarCountELimitOffsetDoRepositorioSql() {
        FiltroConsultaDTO filtro = filtroPadrao();
        PerformanceEntregaRowDTO row = new PerformanceEntregaRowDTO(
                123L,
                "2026-04-02T10:00:00-03:00",
                "CWB",
                "SPO",
                "2026-04-05T00:00:00",
                null,
                0,
                "NO PRAZO"
        );
        sqlRepository.performanceTotal = 25L;
        sqlRepository.performanceLinhas = List.of(row);

        PaginaDTO<PerformanceEntregaRowDTO> pagina = service.buscarTabelaPaginada(filtro, 2, 10);

        assertThat(pagina.conteudo()).containsExactly(row);
        assertThat(pagina.totalElementos()).isEqualTo(25);
        assertThat(pagina.totalPaginas()).isEqualTo(3);
        assertThat(pagina.paginaAtual()).isEqualTo(2);
        assertThat(sqlRepository.performanceOffset).isEqualTo(10);
        assertThat(sqlRepository.performanceLimite).isEqualTo(10);
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(
                LocalDate.of(2026, 4, 1),
                LocalDate.of(2026, 4, 30),
                Map.of()
        );
    }

    private static EscopoFilialService escopoSemRestricao() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }
}
