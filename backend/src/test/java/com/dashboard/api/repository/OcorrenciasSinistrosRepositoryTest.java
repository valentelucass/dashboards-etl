package com.dashboard.api.repository;

import com.dashboard.api.service.ValidadorPeriodoService;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OcorrenciasSinistrosRepositoryTest {
    @Test
    void paginacaoUsaODeslocamentoDoTamanhoSolicitadoEPreservaOEscopoDaFilial() throws Exception {
        var jdbc = mock(NamedParameterJdbcOperations.class);
        var escopos = mock(EscopoFilialService.class);
        when(escopos.escopoAtual()).thenReturn(new EscopoFilialService.EscopoFilial(false, List.of("AGU")));
        var repo = new OcorrenciasSinistrosRepository(jdbc, escopos, mock(ValidadorPeriodoService.class), new ObjectMapper());
        when(jdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(String.class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            SqlParameterSource parametros = invocation.getArgument(1);
            assertTrue(sql.contains("IN (:filiais)"));
            assertEquals(List.of("AGU"), parametros.getValue("filiais"));
            assertEquals(400L, parametros.getValue("deslocamento"));
            assertEquals(200, parametros.getValue("limite"));
            return "{\"total\":0,\"linhas\":[]}";
        });
        var data = LocalDate.of(2026, 11, 1);
        assertEquals(0, repo.relacao(data, data, 2, 200).get("total").asInt());
        for (int tamanho : List.of(0, -1, 201)) {
            assertThrows(IllegalArgumentException.class, () -> repo.relacao(data, data, 0, tamanho));
        }
        assertThrows(IllegalArgumentException.class, () -> repo.relacao(data, data, -1, 25));
    }
}
