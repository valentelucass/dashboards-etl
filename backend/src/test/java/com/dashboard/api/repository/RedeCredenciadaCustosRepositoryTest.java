package com.dashboard.api.repository;

import com.dashboard.api.dto.redecredenciada.RedeCredenciadaCustosDTO;
import com.dashboard.api.service.ValidadorPeriodoService;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RedeCredenciadaCustosRepositoryTest {
    @Test void periodoCobertoSemLinhasRetornaZeroEPreservaOEscopo() throws Exception {
        var jdbc = mock(NamedParameterJdbcTemplate.class);
        var escopo = mock(EscopoFilialService.class);
        when(escopo.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.semAcesso());
        when(jdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(Integer.class)))
                .thenReturn(1);
        var resultadoVazio = mock(ResultSet.class);
        when(jdbc.query(anyString(), any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<ResultSetExtractor<RedeCredenciadaCustosDTO>>any()))
                .thenAnswer(args -> {
                    String sql = args.getArgument(0);
                    assertTrue(sql.contains("CASE WHEN 1=0 THEN 1 ELSE 0 END"));
                    assertTrue(sql.contains("b.parceiro IN (:parceiros)"));
                    SqlParameterSource parametros = args.getArgument(1);
                    assertEquals(List.of("Transportes, Ltda."), parametros.getValue("parceiros"));
                    ResultSetExtractor<RedeCredenciadaCustosDTO> leitor = args.getArgument(2);
                    return leitor.extractData(resultadoVazio);
                });
        var repositorio = new RedeCredenciadaCustosRepository(jdbc, new ValidadorPeriodoService(), escopo);
        LocalDate dia = LocalDate.of(2026, 11, 1);
        var resultado = repositorio.consultar(dia, dia, List.of("Transportes, Ltda."), List.of());
        assertEquals(1, resultado.diasCobertos());
        assertEquals(1, resultado.diasSolicitados());
        assertEquals(List.of(), resultado.linhas());
        assertEquals(0, resultado.totais().consolidacoes());
        assertEquals(0, resultado.totais().freteVinculadoCentavos());
    }
}
