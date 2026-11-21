package com.dashboard.api.repository;

import java.sql.SQLException;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SuppressWarnings("unchecked")
class ComprovantesArquivadosRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final ComprovantesArquivadosRepository arquivos = new ComprovantesArquivadosRepository(jdbc);
    private final LocalDate inicio = LocalDate.of(2026,11,1);
    private final LocalDate fim = inicio.plusDays(20);

    @Test
    void publicacaoAusenteNaoSeConfundeComPeriodoConferido() {
        when(jdbc.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenThrow(falha(5313));
        var cobertura = arquivos.coberturaArquivos(inicio, fim);
        assertThat(cobertura.completa()).isFalse();
        assertThat(cobertura.diasSolicitados()).isEqualTo(21);
        assertThat(cobertura.dataInicial()).isNull();
    }

    @Test
    void falhasDeAcessoNaoViramCoberturaVazia() {
        when(jdbc.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenThrow(falha(229));
        assertThatThrownBy(() -> arquivos.coberturaArquivos(inicio, fim)).isInstanceOf(BadSqlGrammarException.class);
    }

    private BadSqlGrammarException falha(int codigo) {
        return new BadSqlGrammarException("teste", "sql", new SQLException("teste", "S0001", codigo));
    }
}
