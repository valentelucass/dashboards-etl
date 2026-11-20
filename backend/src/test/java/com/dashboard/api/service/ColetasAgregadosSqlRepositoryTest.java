package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.coletas.ColetasHistoricoPeriodo;
import com.dashboard.api.dto.coletas.ColetasOverviewDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.ColetasAgregadosSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ColetasAgregadosSqlRepositoryTest {

    @Mock
    private NamedParameterJdbcOperations jdbcTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void buscarOverviewDeveDeduplicarEAgregarNoSql() {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(new ColetasOverviewDTO(
                        "2026-04-30T12:00:00",
                        0,
                        0,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO
                ));

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarOverview(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of())
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("ROW_NUMBER() OVER")
                .contains("PARTITION BY [ID]")
                .contains("COUNT(1) AS total_coletas")
                .contains("SUM(CASE WHEN status_normalizado IN (N'finalizada', N'coletada')")
                .contains("AVG(CASE")
                .contains("[Solicitacao] >= :dataInicio AND [Solicitacao] < :dataFimExclusivo")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .doesNotContain("TRY_CONVERT(date, [Solicitacao])");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarRegioesOrigemDeveAgregarColetasEPesoTaxado() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarRegioesOrigem(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of())
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("COUNT(DISTINCT [Coleta]) AS total_coletas")
                .contains("SUM(COALESCE([Peso Taxado], 0)) AS peso_taxado")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .contains("GROUP BY COALESCE(NULLIF(TRIM(JSON_VALUE([Metadata], '$.pck_prn_name'))")
                .contains("Sem região informada");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarStatusDistribuicaoDeveAgruparStatusNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarStatusDistribuicao(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of())
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("COUNT(1) AS total")
                .contains("GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))")
                .contains("ROW_NUMBER() OVER")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .doesNotContain("TRY_CONVERT(date, [Solicitacao])");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarSerieTemporalDevePreservarSerieDeVolumeNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarSerieTemporal(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of())
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("COUNT(1) AS total_coletas")
                .contains("SUM(CASE WHEN status_normalizado IN (N'finalizada', N'coletada') THEN 1 ELSE 0 END) AS finalizadas")
                .contains("GROUP BY data_solicitacao")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .doesNotContain("performance_percentual")
                .doesNotContain("meta_percentual")
                .doesNotContain("TRY_CONVERT(date, [Solicitacao])");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarHistoricoPerformanceDeveAgruparPorDataSolicitacaoNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarHistoricoPerformance(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of())
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> paramsCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), paramsCaptor.capture(), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("CAST([Solicitacao] AS date) AS data_solicitacao")
                .contains("[Solicitacao] >= :historicoDataInicio")
                .contains("[Solicitacao] < :historicoDataFimExclusivo")
                .contains("status_normalizado IN (N'finalizada', N'coletada')")
                .contains("SUM(no_prazo) AS no_prazo")
                .contains("SUM(fora_do_prazo) AS fora_do_prazo")
                .contains("data_bucket AS [date]")
                .contains("CAST(COALESCE(CAST(no_prazo AS FLOAT) * 100.0 / NULLIF(no_prazo + fora_do_prazo, 0), 0) AS DECIMAL(19,2)) AS performancePercentual")
                .contains("CAST(100.0 AS DECIMAL(19,2)) AS metaPercentual")
                .contains("no_prazo AS noPrazo")
                .contains("fora_do_prazo AS foraDoPrazo")
                .contains("GROUP BY data_solicitacao")
                .contains("ORDER BY data_bucket")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .doesNotContain("SELECT TOP (8)")
                .doesNotContain("GROUP BY NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), N'')")
                .doesNotContain("AS performance_percentual")
                .doesNotContain("AS meta_percentual")
                .doesNotContain("[Solicitacao] >= :dataInicio")
                .doesNotContain("[Solicitacao] < :dataFimExclusivo")
                .doesNotContain("TRY_CONVERT(date, [Solicitacao])");
        assertThat(paramsCaptor.getValue().getValue("historicoDataInicio")).isEqualTo(LocalDate.of(2026, 4, 1));
        assertThat(paramsCaptor.getValue().getValue("historicoDataFimExclusivo")).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(paramsCaptor.getValue().getValues()).doesNotContainKeys("dataInicio", "dataFimExclusivo");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarHistoricoPerformanceMensalDeveTruncarDataParaInicioDoMesNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarHistoricoPerformance(
                new FiltroConsultaDTO(LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 18), Map.of()),
                ColetasHistoricoPeriodo.SEIS_MESES,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 6, 18)
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> paramsCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), paramsCaptor.capture(), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("CAST([Solicitacao] AS date) AS data_solicitacao")
                .contains("CAST(DATEADD(month, DATEDIFF(month, 0, data_solicitacao), 0) AS date) AS data_bucket")
                .contains("GROUP BY CAST(DATEADD(month, DATEDIFF(month, 0, data_solicitacao), 0) AS date)")
                .contains("ORDER BY data_bucket")
                .contains("data_bucket AS [date]")
                .contains("AS performancePercentual")
                .contains("AS metaPercentual")
                .contains("[Solicitacao] >= :historicoDataInicio")
                .contains("[Solicitacao] < :historicoDataFimExclusivo")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .doesNotContain("[Solicitacao] >= :dataInicio")
                .doesNotContain("[Solicitacao] < :dataFimExclusivo")
                .doesNotContain("FORMAT(")
                .doesNotContain("TRY_CONVERT(date, [Solicitacao])");
        assertThat(paramsCaptor.getValue().getValue("historicoDataInicio")).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(paramsCaptor.getValue().getValue("historicoDataFimExclusivo")).isEqualTo(LocalDate.of(2026, 6, 19));
        assertThat(paramsCaptor.getValue().getValues()).doesNotContainKeys("dataInicio", "dataFimExclusivo");
    }

    @Test
    void buscarAgingDeveUsarDataReferenciaParametrizadaEStatusPendentesParametrizados() {
        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarAgingAbertas(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of()),
                LocalDate.of(2026, 5, 23)
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> paramsCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), paramsCaptor.capture(), any(RowCallbackHandler.class));

        assertThat(sqlCaptor.getValue())
                .contains("DATEDIFF(day, [Solicitacao], :dataReferencia)")
                .contains("IN (:statusPendentes)")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .doesNotContain("GETDATE()")
                .doesNotContain("TRY_CONVERT(date, [Solicitacao])");
        assertThat(paramsCaptor.getValue().getValue("dataReferencia")).isEqualTo(LocalDate.of(2026, 5, 23));
        assertThat(paramsCaptor.getValue().getValue("statusPendentes")).isEqualTo(List.of("pendente", "em aberto"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarCidadesOrigemDeveExcluirColetasExcluidasDosTotais() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        ColetasAgregadosSqlRepository repository = new ColetasAgregadosSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarCidadesOrigem(
                new FiltroConsultaDTO(LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), Map.of()),
                "Sudeste"
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("COUNT(DISTINCT [Coleta]) AS total_coletas")
                .contains("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status])))) <> N'excluída'")
                .contains("COALESCE(NULLIF(TRIM(JSON_VALUE([Metadata], '$.pck_prn_name')), N''), N'Sem região informada') = :regiaoLogisticaSelecionada")
                .contains("GROUP BY COALESCE(NULLIF(LTRIM(RTRIM([Cidade]))");
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
