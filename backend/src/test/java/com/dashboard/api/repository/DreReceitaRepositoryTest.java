package com.dashboard.api.repository;

import com.dashboard.api.service.acesso.EscopoFilialService;
import java.sql.Date;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
class DreReceitaRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final EscopoFilialService escopos = mock(EscopoFilialService.class);
    private final DreReceitaRepository repo = new DreReceitaRepository(jdbc, escopos);
    private final YearMonth novembro = YearMonth.of(2026, 11);

    @Test void usaMesEJaneiroComFimExclusivoEAplicaEscopoEmTodasAsConsultas() {
        when(escopos.escopoAtual()).thenReturn(new EscopoFilialService.EscopoFilial(false, List.of("TESTE")));
        var filtro = new DreReceitaRepository.Filtro(novembro, "12345678", "TESTE", "Operação");
        repo.resumo(filtro);
        repo.fretes(filtro, "FTL", "NORMAL", false, 0);
        repo.dimensoes(novembro);
        var sql = ArgumentCaptor.forClass(String.class);
        var params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbc, times(3)).query(sql.capture(), params.capture(), any(RowMapper.class));
        assertThat(sql.getAllValues()).allSatisfy(s -> assertThat(s).contains("excluido_na_origem = 0", "LOWER(filial_nome) IN (:permitidas)"));
        assertThat(params.getAllValues()).allSatisfy(p -> assertThat(p.getValue("permitidas")).isEqualTo(List.of("teste")));
        assertThat(sql.getAllValues().get(0)).contains("GROUPING SETS", "SUM(valor)");
        assertThat(sql.getAllValues().get(1)).contains("= :classe", "= :tipo", "frete_id DESC");
        assertThat(params.getAllValues().get(0).getValues()).containsEntry("inicio", Date.valueOf("2026-01-01"))
                .containsEntry("mes", Date.valueOf("2026-11-01")).containsEntry("fim", Date.valueOf("2026-12-01"))
                .containsEntry("empresa", "12345678").containsEntry("centro", "Operação");
        assertThat(params.getAllValues().get(1).getValue("inicio")).isEqualTo(Date.valueOf("2026-11-01"));
        verify(jdbc).queryForObject(contains("LOWER(filial_nome) IN (:permitidas)"), any(MapSqlParameterSource.class), any(RowMapper.class));
    }

    @Test void semFiliaisNaoRetornaNomesNemValoresMesmoComFiltroExplicito() {
        when(escopos.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.semAcesso());
        var filtro = new DreReceitaRepository.Filtro(novembro, null, "FILIAL DE OUTRO USUÁRIO", null);
        repo.resumo(filtro);
        repo.fretes(filtro, null, null, true, 0);
        repo.dimensoes(novembro);
        verify(jdbc,times(3)).query(contains("AND 1 = 0"), any(MapSqlParameterSource.class), any(RowMapper.class));
        verify(jdbc).queryForObject(contains("AND 1 = 0"), any(MapSqlParameterSource.class), any(RowMapper.class));
    }

    @Test void janeiroNaoIncorporaDezembroDoAnoAnterior() {
        when(escopos.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.comAcessoTotal());
        repo.resumo(new DreReceitaRepository.Filtro(YearMonth.of(2026, 1), null, null, null));
        var params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbc).query(anyString(), params.capture(), any(RowMapper.class));
        assertThat(params.getValue().getValue("inicio")).isEqualTo(params.getValue().getValue("mes"));
        assertThat(params.getValue().getValue("fim")).isEqualTo(Date.valueOf("2026-02-01"));
    }
}
