package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.contaspagar.ContasAPagarOverviewDTO;
import com.dashboard.api.dto.contaspagar.ContasAPagarGranularidade;
import com.dashboard.api.dto.contaspagar.ContasAPagarReferenciaTemporal;
import com.dashboard.api.dto.contaspagar.ContasAPagarDrilldownNivel;
import com.dashboard.api.dto.contaspagar.ContasAPagarMetrica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.ContasAPagarSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.RowMapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContasAPagarSqlRepositoryTest {

    @Mock
    private NamedParameterJdbcOperations jdbcTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void buscarOverviewDeveAgregarNoSqlComFiltroDeDataSargable() {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(new ContasAPagarOverviewDTO(
                        "2026-03-23T09:00:00",
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        0.0,
                        0.0,
                        0.0
                ));

        ContasAPagarSqlRepository repository = new ContasAPagarSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarOverview(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("[Emissão] >= :dataInicio AND [Emissão] < :dataFimExclusivo")
                .contains("SUM(COALESCE([Valor a pagar], 0)) AS valor_a_pagar")
                .contains("SUM(COALESCE([Valor pago], 0)) AS valor_pago")
                .contains("DATEDIFF(day, [Emissão], [Baixa/Data liquidação])")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), [Conciliado])))) = N'conciliado'")
                .doesNotContain("LIKE N'%conciliado%'")
                .doesNotContain("TRY_CONVERT(date, [Emissão])")
                .doesNotContain("WHERE TRY_CONVERT");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarSerieDeveAgruparPorMesNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(java.util.List.of());

        ContasAPagarSqlRepository repository = new ContasAPagarSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarSerie(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("CONVERT(CHAR(7), [Emissão], 23) AS mes")
                .contains("GROUP BY CONVERT(CHAR(7), [Emissão], 23)")
                .contains("SUM(COALESCE([Valor a pagar], 0) - COALESCE([Valor pago], 0))");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarSerieDevePermitirDiaPorLiquidacaoComFiltroSargable() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(java.util.List.of());
        ContasAPagarSqlRepository repository = new ContasAPagarSqlRepository(
                jdbcTemplate, new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()), escopoSemRestricao());

        repository.buscarSerie(filtroPadrao(), ContasAPagarGranularidade.DIA, ContasAPagarReferenciaTemporal.LIQUIDACAO);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        assertThat(sqlCaptor.getValue())
                .contains("[Baixa/Data liquidação] >= :dataInicio AND [Baixa/Data liquidação] < :dataFimExclusivo")
                .contains("CONVERT(CHAR(10), [Baixa/Data liquidação], 23) AS mes")
                .doesNotContain("TRY_CONVERT(date, [Baixa/Data liquidação])");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarDrilldownDeveAplicarTopNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(java.util.List.of());
        ContasAPagarSqlRepository repository = new ContasAPagarSqlRepository(
                jdbcTemplate, new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()), escopoSemRestricao());

        repository.buscarDrilldownFornecedores(filtroPadrao(), 5, ContasAPagarMetrica.SALDO_ABERTO,
                ContasAPagarDrilldownNivel.RAIZ, null, null);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        assertThat(sqlCaptor.getValue())
                .contains("SELECT TOP (:drillLimite) label, valor, titulos")
                .contains("ORDER BY valor DESC, label")
                .contains("SUM(COALESCE([Valor a pagar], 0) - COALESCE([Valor pago], 0))");
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), Map.of());
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
