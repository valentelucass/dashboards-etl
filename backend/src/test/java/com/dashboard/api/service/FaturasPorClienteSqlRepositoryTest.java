package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteMensalDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteOverviewDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteGranularidade;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusEvolucaoDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.FaturasPorClienteSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import javax.sql.rowset.CachedRowSet;
import javax.sql.rowset.RowSetMetaDataImpl;
import javax.sql.rowset.RowSetProvider;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.RowMapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FaturasPorClienteSqlRepositoryTest {

    @Mock
    private NamedParameterJdbcOperations jdbcTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void evolucaoMantemOrdemDosMesesEContaCadaRegistroUmaVez() throws Exception {
        RowSetMetaDataImpl metadata = new RowSetMetaDataImpl();
        metadata.setColumnCount(2);
        configurarColuna(metadata, 1, "periodo", Types.VARCHAR);
        configurarColuna(metadata, 2, "situacao", Types.INTEGER);
        try (CachedRowSet rows = RowSetProvider.newFactory().createCachedRowSet()) {
            rows.setMetaData(metadata);
            String[] meses = {"2026-09", "2026-10", "2026-09", "2026-09", "2026-11"};
            int[] situacoes = {1, 2, 1, 2, 0};
            for (int i = 0; i < meses.length; i++) {
                rows.moveToInsertRow();
                rows.updateString("periodo", meses[i]);
                rows.updateInt("situacao", situacoes[i]);
                rows.insertRow();
                rows.moveToCurrentRow();
            }
            rows.beforeFirst();
            when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(ResultSetExtractor.class)))
                    .thenAnswer(invocation -> {
                        ResultSetExtractor<?> extrator = invocation.getArgument(2);
                        return extrator.extractData(rows);
                    });
            var repository = new FaturasPorClienteSqlRepository(jdbcTemplate,
                    new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()), escopoSemRestricao());
            assertThat(repository.buscarEvolucaoStatus(filtroPadrao(), FaturasPorClienteGranularidade.MES))
                    .containsExactly(new FaturasPorClienteStatusEvolucaoDTO("2026-09", 2, 1),
                            new FaturasPorClienteStatusEvolucaoDTO("2026-10", 0, 1),
                            new FaturasPorClienteStatusEvolucaoDTO("2026-11", 0, 0));
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarOverviewDeveAgregarFatoNoSqlComPeriodoSargable() {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(new FaturasPorClienteOverviewDTO(
                        "2026-03-23T09:00:00",
                        BigDecimal.ZERO,
                        0,
                        0,
                        0,
                        0.0,
                        0
                ));

        FaturasPorClienteSqlRepository repository = new FaturasPorClienteSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarOverview(filtroPadrao(), LocalDate.of(2026, 3, 23));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("dbo.fato_gestao_vista_faturas")
                .contains("data_emissao_cte >= :inicioOffset AND data_emissao_cte < :fimOffset")
                .contains("excluido_na_origem = 0")
                .contains("SUM(CASE WHEN status_processo = N'Faturado' THEN valor_operacional ELSE 0 END)")
                .contains("COUNT(DISTINCT cliente_chave) AS clientes_ativos")
                .doesNotContain("ROW_NUMBER() OVER")
                .doesNotContain("WHERE TRY_CONVERT")
                .doesNotContain("TRY_CONVERT(datetimeoffset, data_emissao_cte)");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarOverviewDeveConverterSnapshotUtcParaHorarioOperacional() throws Exception {
        when(jdbcTemplate.queryForObject(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper<FaturasPorClienteOverviewDTO> mapper = invocation.getArgument(2);
                    return mapper.mapRow(overviewRowSet(Timestamp.valueOf("2026-06-08 22:05:00")), 0);
                });

        FaturasPorClienteSqlRepository repository = new FaturasPorClienteSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        FaturasPorClienteOverviewDTO overview = repository.buscarOverview(filtroPadrao(), LocalDate.of(2026, 6, 8));

        assertThat(overview.updatedAt()).isEqualTo("2026-06-08T19:05:00-03:00");
    }

    private static CachedRowSet overviewRowSet(Timestamp updatedAt) throws Exception {
        RowSetMetaDataImpl metadata = new RowSetMetaDataImpl();
        metadata.setColumnCount(7);
        configurarColuna(metadata, 1, "updated_at", Types.TIMESTAMP);
        configurarColuna(metadata, 2, "valor_faturado", Types.DECIMAL);
        configurarColuna(metadata, 3, "registros_faturados", Types.INTEGER);
        configurarColuna(metadata, 4, "aguardando_faturamento", Types.INTEGER);
        configurarColuna(metadata, 5, "titulos_em_atraso", Types.INTEGER);
        configurarColuna(metadata, 6, "prazo_medio_dias", Types.DECIMAL);
        configurarColuna(metadata, 7, "clientes_ativos", Types.INTEGER);

        CachedRowSet rowSet = RowSetProvider.newFactory().createCachedRowSet();
        rowSet.setMetaData(metadata);
        rowSet.moveToInsertRow();
        rowSet.updateTimestamp("updated_at", updatedAt);
        rowSet.updateBigDecimal("valor_faturado", BigDecimal.ZERO);
        rowSet.updateInt("registros_faturados", 0);
        rowSet.updateInt("aguardando_faturamento", 0);
        rowSet.updateInt("titulos_em_atraso", 0);
        rowSet.updateBigDecimal("prazo_medio_dias", BigDecimal.ZERO);
        rowSet.updateInt("clientes_ativos", 0);
        rowSet.insertRow();
        rowSet.moveToCurrentRow();
        rowSet.beforeFirst();
        rowSet.next();
        return rowSet;
    }

    private static void configurarColuna(RowSetMetaDataImpl metadata, int indice, String nome, int tipo) throws Exception {
        metadata.setColumnName(indice, nome);
        metadata.setColumnLabel(indice, nome);
        metadata.setColumnType(indice, tipo);
    }

    @Test
    @SuppressWarnings("unchecked")
    void buscarMensalDeveAgruparPorMesReferenciaNoSql() {
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of(new FaturasPorClienteMensalDTO("2026-03", BigDecimal.ZERO, 0)));

        FaturasPorClienteSqlRepository repository = new FaturasPorClienteSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarMensal(filtroPadrao());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));

        assertThat(sqlCaptor.getValue())
                .contains("CONVERT(CHAR(7), data_referencia_mensal, 23) AS mes")
                .contains("SUM(valor_operacional)")
                .contains("GROUP BY CONVERT(CHAR(7), data_referencia_mensal, 23)");
    }

    @Test
    void buscarAgingDeveFiltrarTitulosAntesDoDatediff() {
        FaturasPorClienteSqlRepository repository = new FaturasPorClienteSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );

        repository.buscarAging(filtroPadrao(), LocalDate.of(2026, 3, 23));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowCallbackHandler.class));

        assertThat(sqlCaptor.getValue())
                .contains("data_emissao_cte >= :inicioOffset AND data_emissao_cte < :fimOffset")
                .contains("titulos_aging AS")
                .contains("FROM base_normalizada")
                .contains("WHERE status_processo = N'Faturado'")
                .contains("AND status_pagamento <> N'baixado'")
                .contains("aging_calculado AS")
                .contains("DATEDIFF(day, data_vencimento_fatura, :dataReferencia)")
                .contains("FROM aging_calculado")
                .doesNotContain("DATEDIFF(day, data_vencimento_fatura, :dataReferencia) <= 15");
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 2, 21), LocalDate.of(2026, 3, 23), Map.of());
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
