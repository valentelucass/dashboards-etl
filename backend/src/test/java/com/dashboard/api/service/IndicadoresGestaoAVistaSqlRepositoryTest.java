package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.indicadoresgestao.NivelVisaoPerformance;
import com.dashboard.api.repository.IndicadoresGestaoAVistaSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import com.dashboard.api.repository.PerformanceDashboardSqlRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.RowMapper;
import static org.assertj.core.api.Assertions.assertThat;

class IndicadoresGestaoAVistaSqlRepositoryTest {

    @Test
    void performanceUsaMinutasDaTelaPerformanceECubagemUsaFatoParticionado() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        IndicadoresGestaoAVistaSqlRepository repository = new IndicadoresGestaoAVistaSqlRepository(
                jdbcTemplate,
                PeriodoOffsetDateTimeHelper.padrao(),
                new PerformanceDashboardSqlRepository(jdbcTemplate, new ValidadorPeriodoService(), null)
        );

        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 6, 29),
                Map.of("filiais", List.of("SPO"))
        );
        EscopoFilialService.EscopoFilial escopo = EscopoFilialService.EscopoFilial.comAcessoTotal();

        repository.buscarPerformanceEntregaSerie(filtro, escopo);
        repository.buscarCubagemSerie(filtro, escopo);
        repository.buscarIndenizacaoSerie(filtro, escopo);
        repository.buscarUtilizacaoColetoresSerie(filtro, escopo);

        String performanceSql = jdbcTemplate.sqls.get(0);
        String cubagemSql = jdbcTemplate.sqls.get(1);
        String indenizacaoSql = jdbcTemplate.sqls.get(2);
        String coletoresSql = jdbcTemplate.sqls.get(3);

        assertThat(performanceSql)
                .contains("FROM dbo.vw_fretes_powerbi", "WHERE rn = 1", "NULLIF(SUM(is_finalizada), 0)")
                .contains("SUM(CAST(is_no_prazo AS BIGINT))", "OFFSET 0 ROWS FETCH NEXT :limitePerformanceDrilldown")
                .doesNotContain("dbo.fato_gestao_vista_fretes");

        assertThat(cubagemSql)
                .contains("FROM dbo.fato_gestao_vista_fretes")
                .contains("WHERE indicador_codigo = 'CB'")
                .contains("AND data_referencia >= :dataInicio")
                .contains("AND data_referencia < :dataFimExclusivo")
                .contains("AND is_pagador_excluido_cubagem = 0")
                .contains("FROM dbo.cliente_excecao_cubagem excecao")
                .contains("excecao.cliente_cnpj = pagador_documento_key")
                .contains("SUM(CAST(is_cubado AS BIGINT))")
                .doesNotContain("vw_fretes_powerbi")
                .doesNotContain("fretes_deduplicados")
                .doesNotContain("ROW_NUMBER()")
                .doesNotContain("[Data frete]")
                .doesNotContain("docsExcluidos");

        assertThat(indenizacaoSql)
                .contains("WHERE [Data abertura] >= :dataInicio")
                .contains("AND [Data abertura] < :dataFimExclusivo")
                .contains("FROM dbo.fato_fretes_faturamento")
                .contains("snapshot_em AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time'")
                .contains("data_referencia_faturamento_date >= :dataInicio")
                .contains("data_referencia_faturamento_date < :dataFimExclusivo")
                .contains("faturamento_mensal AS")
                .contains("SUM(ABS(valor_a_pagar_cliente))")
                .contains("SUM(COALESCE(faturamento, 0))")
                .contains("receita_bruta AS faturamento")
                .doesNotContain("vw_fretes_powerbi")
                .doesNotContain("elegivel_operacional_com_valor");

        assertThat(coletoresSql)
                .contains("FROM dbo.fato_gestao_vista_coletores")
                .contains("WHERE data_referencia >= :dataInicio")
                .contains("AND data_referencia < :dataFimExclusivo")
                .contains("AND is_linha_valida_indicador = 1")
                .contains("AND excluido_na_origem = 0")
                .contains("SUM(manifestos_bipados)")
                .contains("SUM(manifestos_emitidos)")
                .contains("SUM(manifestos_descarregamento)")
                .contains("SUM(total_manifestos)")
                .doesNotContain("vw_manifestos_powerbi")
                .doesNotContain("vw_inventario_powerbi")
                .doesNotContain("ROW_NUMBER()")
                .doesNotContain("STRING_SPLIT");

        assertThat(String.join("\n", cubagemSql, indenizacaoSql, coletoresSql))
                .doesNotContain("WHERE TRY_CONVERT")
                .doesNotContain("AND TRY_CONVERT");

        assertThat(String.join("\n", jdbcTemplate.sqls))
                .doesNotContain("WHERE YEAR(")
                .doesNotContain("AND YEAR(")
                .doesNotContain("WHERE MONTH(")
                .doesNotContain("AND MONTH(");
    }

    @Test
    void performanceDrilldownAplicaFiltrosHierarquicosSemSqlDinamicoLivre() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        IndicadoresGestaoAVistaSqlRepository repository = new IndicadoresGestaoAVistaSqlRepository(
                jdbcTemplate,
                PeriodoOffsetDateTimeHelper.padrao(),
                new PerformanceDashboardSqlRepository(jdbcTemplate, new ValidadorPeriodoService(), null)
        );

        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 31),
                Map.of()
        );

        repository.buscarPerformanceEntregaSerie(
                filtro,
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                NivelVisaoPerformance.CIDADE,
                "Responsavel A",
                "SP"
        );

        assertThat(jdbcTemplate.sqls.get(0))
                .contains("COALESCE(NULLIF(destino_cidade")
                .contains("responsavel_regiao_destino = :responsavelFiltro")
                .contains("filial_performance = :responsavelFiltro")
                .contains("regiao_destino = :regiaoFiltro")
                .doesNotContain("COALESCE(NULLIF(regiao_destino, N''), N'SEM_REGIAO') = :regiaoFiltro");
    }

    private static final class CapturandoNamedParameterJdbcTemplate extends NamedParameterJdbcTemplate {
        private final List<String> sqls = new ArrayList<>();

        private CapturandoNamedParameterJdbcTemplate() {
            super(new JdbcTemplate());
        }

        @Override
        public <T> List<T> queryForList(String sql, SqlParameterSource params, Class<T> type) {
            return List.of("Comprovante Anexado", "Responsável Região Destino Key", "Tipo Frete", "CT-e Emissão")
                    .stream().map(type::cast).toList();
        }

        @Override
        public Map<String, Object> queryForMap(String sql, SqlParameterSource paramSource) {
            sqls.add(sql);
            return Map.ofEntries(
                    Map.entry("updated_at", "2026-06-01T10:00:00"),
                    Map.entry("total_entregas", 0L),
                    Map.entry("entregas_no_prazo", 0L),
                    Map.entry("entregas_fora_do_prazo", 0L),
                    Map.entry("total_fretes", 0L),
                    Map.entry("fretes_cubados", 0L),
                    Map.entry("fretes_com_peso_real", 0L),
                    Map.entry("total_sinistros", 0L),
                    Map.entry("valor_indenizado_original", BigDecimal.ZERO),
                    Map.entry("valor_indenizado_abs", BigDecimal.ZERO),
                    Map.entry("faturamento_base", BigDecimal.ZERO),
                    Map.entry("manifestos_bipados", 0L),
                    Map.entry("manifestos_emitidos", 0L),
                    Map.entry("manifestos_descarregamento", 0L),
                    Map.entry("total_manifestos", 0L),
                    Map.entry("manifestos_incompletos", 0L),
                    Map.entry("pct_utilizacao", BigDecimal.ZERO)
            );
        }

        @Override
        public <T> List<T> query(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            sqls.add(sql);
            return List.of();
        }

        @Override
        public <T> T queryForObject(String sql, SqlParameterSource paramSource, Class<T> requiredType) {
            sqls.add(sql);
            if (Long.class.equals(requiredType)) {
                return requiredType.cast(0L);
            }
            return null;
        }
    }
}
