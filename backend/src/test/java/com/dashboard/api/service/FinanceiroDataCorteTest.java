package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.FaturasPorClienteSqlRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class FinanceiroDataCorteTest {
    @ParameterizedTest
    @CsvSource({
        "2026-10-01, 2026-10-31, 2026-10-31",
        "2026-11-01, 2026-11-30, 2026-11-19"
    })
    void indicadoresUsamOEncerramentoDoPeriodoOuODiaAtual(LocalDate inicio, LocalDate fim, LocalDate corte) {
        var repositorio = mock(FaturasPorClienteSqlRepository.class);
        var relogio = Clock.fixed(Instant.parse("2026-11-19T17:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        var servico = new FaturasPorClienteService(new ValidadorPeriodoService(), repositorio, relogio, null);
        var filtro = new FiltroConsultaDTO(inicio, fim, Map.of());
        servico.buscarOverview(filtro);
        servico.buscarAging(filtro);
        servico.buscarClientesEmAtraso(filtro);
        verify(repositorio).buscarOverview(filtro, corte);
        verify(repositorio).buscarAging(filtro, corte);
        verify(repositorio).buscarClientesEmAtraso(filtro, corte);
    }
}
