package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.ExecutivoFinanceiroSqlRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class ExecutivoServiceTest {
    @Test
    void overviewBuscaApenasReceitaDeFretesEPreservaIndicadoresDosDemaisDominios() {
        var filtro = new FiltroConsultaDTO(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                Map.of("filiais", List.of("CWB")));
        var fretes = mock(FretesService.class);
        var faturas = mock(FaturasPorClienteService.class, RETURNS_DEEP_STUBS);
        var contas = mock(ContasAPagarService.class, RETURNS_DEEP_STUBS);
        var coletas = mock(ColetasService.class, RETURNS_DEEP_STUBS);
        var tracking = mock(TrackingService.class, RETURNS_DEEP_STUBS);
        var manifestos = mock(ManifestosService.class, RETURNS_DEEP_STUBS);
        when(fretes.buscarReceitaBruta(filtro)).thenReturn(new BigDecimal("1234.56"));
        when(faturas.buscarOverview(filtro).valorFaturado()).thenReturn(new BigDecimal("987.65"));
        when(contas.buscarOverview(filtro).saldoAberto()).thenReturn(new BigDecimal("432.10"));
        when(coletas.buscarOverview(filtro).totalColetas()).thenReturn(100);
        when(coletas.buscarOverview(filtro).finalizadas()).thenReturn(70);
        when(tracking.buscarOverview(filtro).previsaoVencida()).thenReturn(8);
        when(manifestos.buscarOverview(filtro).ocupacaoPesoMediaPct()).thenReturn(76.5);
        var service = new ExecutivoService(fretes, faturas, contas, coletas, tracking, manifestos,
                new ValidadorPeriodoService(), mock(ExecutivoFinanceiroSqlRepository.class));

        var resultado = service.buscarOverview(filtro);

        assertThat(resultado.receitaOperacional()).isEqualByComparingTo("1234.56");
        assertThat(resultado.valorFaturado()).isEqualByComparingTo("987.65");
        assertThat(resultado.saldoAPagar()).isEqualByComparingTo("432.10");
        assertThat(resultado.saldoAReceber()).isZero();
        assertThat(resultado.backlogColetas()).isEqualTo(30);
        assertThat(resultado.cargasPrevisaoVencida()).isEqualTo(8);
        assertThat(resultado.ocupacaoMediaManifestos()).isEqualTo(76.5);
        verify(fretes).buscarReceitaBruta(filtro);
        verifyNoMoreInteractions(fretes);
    }
}
