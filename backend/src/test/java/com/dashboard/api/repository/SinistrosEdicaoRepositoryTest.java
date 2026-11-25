package com.dashboard.api.repository;

import com.dashboard.api.dto.sinistros.SinistrosFormularios.Acompanhamento;
import com.dashboard.api.dto.sinistros.SinistrosFormularios.Apolice;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.service.acesso.EscopoFilialService.EscopoFilial;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SinistrosEdicaoRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final EscopoFilialService escopos = mock(EscopoFilialService.class);
    private final SinistrosEdicaoRepository repositorio = new SinistrosEdicaoRepository(jdbc, escopos);
    private final LocalDate inicio = LocalDate.of(2026, 6, 1);
    private final Acompanhamento edicao = new Acompanhamento("Em Andamento", new BigDecimal("20.10"), null, 2);

    private void escopo(boolean global) {
        when(escopos.escopoAtual()).thenReturn(new EscopoFilial(global, List.of("AGU")));
    }

    @Test void usuarioDeFilialNaoAlteraApoliceNemSinistroAlheio() {
        escopo(false);
        assertEquals(403, assertThrows(ResponseStatusException.class, repositorio::apolices).getStatusCode().value());
        when(jdbc.queryForObject(contains("filial IN"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(0);
        assertEquals(404, assertThrows(ResponseStatusException.class,
            () -> repositorio.salvarAcompanhamento(12, edicao, "teste")).getStatusCode().value());
        verify(jdbc, never()).update(anyString(), any(SqlParameterSource.class));
    }

    @Test void revisaoAntigaNaoSobrescreveOutroOperador() {
        escopo(true);
        when(jdbc.queryForObject(startsWith("SELECT COUNT"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(1);
        when(jdbc.queryForObject(contains("MAX(revisao)"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(3);
        assertEquals(409, assertThrows(ResponseStatusException.class,
            () -> repositorio.salvarAcompanhamento(12, edicao, "teste")).getStatusCode().value());
        verify(jdbc, never()).update(anyString(), any(SqlParameterSource.class));
    }

    @Test void alteraUmaVezORegistroNaRevisaoAtual() {
        escopo(true);
        when(jdbc.queryForObject(startsWith("SELECT COUNT"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(1);
        when(jdbc.queryForObject(contains("MAX(revisao)"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(2);
        repositorio.salvarAcompanhamento(12, edicao, "teste");
        verify(jdbc).update(contains("revisao=revisao+1"), argThat((SqlParameterSource p) ->
            p.getValue("franquia").equals(new BigDecimal("20.10")) && p.getValue("salvados") == null
            && p.getValue("status").equals("Em Andamento") && p.getValue("usuario").equals("teste")));
    }

    @Test void recusaVigenciaInvertidaOuSobrepostaDoMesmoNumero() {
        escopo(true);
        var invertida = new Apolice("001", inicio, inicio.minusDays(1), BigDecimal.TEN, 0);
        assertEquals(400, assertThrows(ResponseStatusException.class,
            () -> repositorio.salvarApolice(null, invertida, "teste")).getStatusCode().value());
        var valida = new Apolice("001", inicio, inicio.plusMonths(12).minusDays(1), BigDecimal.TEN, 0);
        when(jdbc.queryForObject(contains("inicio<=:fim"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(1);
        assertEquals(409, assertThrows(ResponseStatusException.class,
            () -> repositorio.salvarApolice(null, valida, "teste")).getStatusCode().value());
        verify(jdbc, never()).update(anyString(), any(SqlParameterSource.class));
    }
}
