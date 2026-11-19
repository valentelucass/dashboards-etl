package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.etl.EtlSaudeOverviewDTO;
import com.dashboard.api.repository.EtlSaudeSqlRepository;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EtlSaudeSqlRepositoryTest {

    @Mock
    private NamedParameterJdbcOperations jdbcTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void buscarOverviewDeveAgregarMetricasNoSqlServer() {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(new EtlSaudeOverviewDTO("2026-03-23T09:00:00", 0.0, 0, 0, 0, 0.0));

        repository().buscarOverview(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("FROM dbo.log_extracoes log")
                .contains("log.timestamp_inicio >= :dataInicio")
                .contains("log.timestamp_inicio < :dataFimExclusivo")
                .contains("COUNT(CASE WHEN status_normalizado <> N'ADIADO' THEN 1 END) AS total_execucoes")
                .contains("WHEN status_normalizado = N'ADIADO' THEN NULL")
                .contains("DATEDIFF_BIG(SECOND, timestamp_inicio, timestamp_fim)")
                .contains("SUM(CASE WHEN status_normalizado NOT IN (N'COMPLETO', N'SUCCESS', N'SUCESSO', N'ADIADO') THEN 1 ELSE 0 END) AS execucoes_com_erro")
                .contains("SUM(registros_processados) AS volume_processado_total")
                .contains("SUM(CASE WHEN status_normalizado IN (N'COMPLETO', N'SUCCESS', N'SUCESSO') THEN 1 ELSE 0 END) AS execucoes_sucesso")
                .contains("MAX(timestamp_fim) AS updated_at")
                .doesNotContain("vw_bi_monitoramento");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarSerieDeveAgruparSucessoFalhaPorTimestampInicioNoSqlServer() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        repository().buscarSerie(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("CAST(log.timestamp_inicio AS DATE) AS data_referencia")
                .contains("UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(40), log.status_final))))")
                .contains("FROM dbo.log_extracoes log")
                .contains("log.timestamp_inicio >= :dataInicio")
                .contains("log.timestamp_inicio < :dataFimExclusivo")
                .contains("SUM(CASE WHEN status_normalizado IN (N'COMPLETO', N'SUCCESS', N'SUCESSO') THEN 1 ELSE 0 END) AS qtd_sucesso")
                .contains("SUM(CASE WHEN status_normalizado NOT IN (N'COMPLETO', N'SUCCESS', N'SUCESSO', N'ADIADO') THEN 1 ELSE 0 END) AS qtd_falha")
                .contains("GROUP BY data_referencia")
                .contains("ORDER BY data_referencia");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarEvolucaoInsercoesAtualizacoesDeveAgruparPorTimestampInicioNoSqlServer() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        repository().buscarEvolucaoInsercoesAtualizacoes(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("CAST(log.timestamp_inicio AS DATE) AS data_referencia")
                .contains("SUM(COALESCE(log.registros_extraidos, 0)) AS insercoes")
                .contains("SUM(COALESCE(log.noop_count, 0)) AS atualizacoes")
                .contains("FROM dbo.log_extracoes log")
                .contains("log.timestamp_inicio >= :dataInicio")
                .contains("log.timestamp_inicio < :dataFimExclusivo")
                .contains("GROUP BY CAST(log.timestamp_inicio AS DATE)")
                .contains("ORDER BY data_referencia");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarGraficosDeveAgruparCategoriasErroNoSqlServer() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        repository().buscarGraficos(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Categoria Erro]))), N'') AS categoria")
                .contains("COUNT(1) AS total")
                .contains("GROUP BY categoria")
                .contains("ORDER BY total DESC, categoria");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarTabelaDeveAplicarTravaSqlEmLogExtracoes() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        repository().buscarTabela(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("SELECT TOP (5000)")
                .contains("log.timestamp_inicio")
                .contains("log.timestamp_fim")
                .contains("log.status_final")
                .contains("log.registros_extraidos")
                .contains("log.paginas_processadas")
                .contains("log.noop_count")
                .contains("log.mensagem")
                .contains("FROM dbo.log_extracoes log")
                .contains("log.timestamp_inicio >= :dataInicio")
                .contains("log.timestamp_inicio < :dataFimExclusivo")
                .contains("ORDER BY log.timestamp_fim DESC, log.id DESC");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarResumoTabelasDeveAgregarAuditoriaPorEntidadeNoSqlServer() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        repository().buscarResumoTabelas(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), log.entidade))), N''), N'Sem entidade') AS target_entity")
                .contains("CAST(COALESCE(log.registros_extraidos, 0) AS BIGINT)")
                .contains("+ CAST(COALESCE(log.noop_count, 0) AS BIGINT) AS registros_gravados")
                .contains("LOWER(REPLACE(COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), log.entidade))), N''), N'sem_entidade'), N'dbo.', N'')) AS target_key")
                .contains("UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(40), log.status_final))))")
                .contains("FROM dbo.log_extracoes log")
                .contains("log.timestamp_inicio >= :dataInicio")
                .contains("log.timestamp_inicio < :dataFimExclusivo")
                .contains("datas_negocio AS")
                .contains("FROM dbo.vw_coletas_powerbi")
                .contains("FROM dbo.vw_fretes_powerbi")
                .contains("FROM dbo.vw_manifestos_powerbi")
                .contains("FROM dbo.vw_cotacoes_powerbi")
                .contains("FROM dbo.vw_localizacao_cargas_powerbi")
                .contains("FROM dbo.vw_contas_a_pagar_powerbi")
                .contains("FROM dbo.vw_faturas_por_cliente_powerbi")
                .contains("COUNT_BIG(CASE WHEN base_log.status_normalizado <> N'ADIADO' THEN 1 END) AS total_extracoes")
                .contains("SUM(CASE WHEN base_log.status_normalizado IN (N'COMPLETO', N'SUCCESS', N'SUCESSO') THEN 1 ELSE 0 END) AS total_sucessos")
                .contains("SUM(CASE WHEN base_log.status_normalizado NOT IN (N'COMPLETO', N'SUCCESS', N'SUCESSO', N'ADIADO') THEN 1 ELSE 0 END) AS total_falhas")
                .contains("SUM(base_log.registros_gravados) AS total_registros_gravados")
                .contains("MIN(base_log.timestamp_inicio) AS primeira_extracao")
                .contains("MAX(base_log.timestamp_fim) AS ultima_extracao")
                .contains("MIN(datas_negocio.menor_data_negocio) AS menor_data_negocio")
                .contains("MAX(datas_negocio.maior_data_negocio) AS maior_data_negocio")
                .contains("LEFT JOIN datas_negocio")
                .contains("GROUP BY base_log.target_entity, base_log.target_key")
                .contains("ORDER BY total_registros_gravados ASC, target_entity");
    }

    @Test
    @SuppressWarnings("unchecked")
    void totalTabelaDeveContarLogExtracoes() {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(Class.class)))
                .thenReturn(123L);

        long total = repository().totalTabela(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(Class.class));

        assertThat(total).isEqualTo(123L);
        assertThat(sqlCaptor.getValue())
                .contains("SELECT COUNT(1)")
                .contains("FROM dbo.log_extracoes log")
                .contains("log.timestamp_inicio >= :dataInicio")
                .contains("log.timestamp_inicio < :dataFimExclusivo");
    }

    private EtlSaudeSqlRepository repository() {
        return new EtlSaudeSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao())
        );
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 2, 21), LocalDate.of(2026, 3, 23), Map.of());
    }
}
