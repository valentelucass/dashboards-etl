package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.cotacoes.CotacoesOverviewDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.CotacoesDashboardSqlRepository;
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
import org.springframework.jdbc.core.RowMapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CotacoesDashboardSqlRepositoryTest {

    @Mock
    private NamedParameterJdbcOperations jdbcTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void buscarOverviewDeveCalcularReprovacaoPercentualNoSqlSemTruncarInteiros() {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(new CotacoesOverviewDTO(
                        "2026-03-23T09:00:00",
                        0,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.0
                ));

        CotacoesDashboardSqlRepository repository = new CotacoesDashboardSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarOverview(new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                Map.of()
        ));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("status_normalizado IN (N'reprovada', N'reprovado', N'perdida', N'perdido')")
                .contains("SUM(CASE WHEN status_normalizado IN (N'reprovada', N'reprovado', N'perdida', N'perdido') THEN 1 ELSE 0 END) AS reprovadas")
                .contains("CAST(COALESCE(CAST(reprovadas AS FLOAT) * 100.0 / NULLIF(total_cotacoes, 0), 0) AS DECIMAL(19,2)) AS reprovacao_percentual")
                .doesNotContain("aprovacao");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarResumoPorClienteDeveGerarGroupByComTop40OrdenadoPorVolumeEAplicarFiltros() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        CotacoesDashboardSqlRepository repository = new CotacoesDashboardSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarResumoPorCliente(new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                Map.of(
                        "filiais", List.of("SPO"),
                        "usuarios", List.of("Maria Silva"),
                        "clientes", List.of("ACME")
                )
        ));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> paramsCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), paramsCaptor.capture(), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("SELECT TOP (40)")
                .doesNotContain("PARTITION BY [N° Cotação]")
                .contains("GROUP BY agrupador_id")
                .contains("ORDER BY volume_m3 DESC, total_cotacoes DESC, entidade")
                .contains("COUNT(1) AS total_cotacoes")
                .contains("SUM(CASE WHEN status_normalizado IN (N'convertida', N'convertido') THEN 1 ELSE 0 END) AS ganhas")
                .contains("SUM(CASE WHEN (status_normalizado IS NULL OR status_normalizado NOT IN (N'convertida', N'convertido', N'reprovada', N'reprovado', N'perdida', N'perdido')) THEN 1 ELSE 0 END) AS em_aberto")
                .contains("CAST(COALESCE(CAST(SUM(CASE WHEN status_normalizado IN (N'convertida', N'convertido') THEN 1 ELSE 0 END) AS FLOAT) * 100.0 / NULLIF(COUNT(1), 0), 0) AS DECIMAL(19,2)) AS taxa_conversao")
                .contains("CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS frete_cotado")
                .contains("CAST(COALESCE(SUM(CASE WHEN status_normalizado IN (N'convertida', N'convertido') THEN valor_frete ELSE 0 END), 0) AS DECIMAL(19,2)) AS frete_ganho")
                .contains("CAST(COALESCE(SUM(volume_m3), 0) AS DECIMAL(19,2)) AS volume_m3")
                .contains("[Filial] IN (:filtro_filiais)")
                .contains("[Usuario Key] IN (:filtro_usuarios)")
                .contains("[Cliente Pagador] IN (:filtro_clientes)");
        assertThat(paramsCaptor.getValue().getValues())
                .containsEntry("filtro_filiais", List.of("spo"))
                .containsEntry("filtro_usuarios", List.of("maria silva"))
                .containsEntry("filtro_clientes", List.of("acme"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarResumoPorUsuarioDeveAgruparPorChavePublicadaERotuloLegivel() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        CotacoesDashboardSqlRepository repository = new CotacoesDashboardSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarResumoPorUsuario(new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                Map.of()
        ));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuario Key]))), N''), NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuário]))), N''), NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Solicitante]))), N''), N'Sem usuario') AS agrupador_id")
                .contains("COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuário]))), N''), NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Solicitante]))), N''), NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuario Key]))), N''), N'Sem usuario') AS entidade")
                .doesNotContain("SELECT TOP (40)");
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
