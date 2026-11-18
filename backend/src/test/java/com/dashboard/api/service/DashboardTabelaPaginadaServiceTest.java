package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.manifestos.ManifestoResumoDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import static org.assertj.core.api.Assertions.assertThat;

class DashboardTabelaPaginadaServiceTest {

    @Test
    void buscarPrimeiraPaginaColetasDeveDeduplicarComRowNumberEPagearNoSqlServer() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("ID", "coleta-1")));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        service.buscarPrimeiraPaginaColetas(filtroPadrao(), 150);

        assertThat(jdbcTemplate.sqls()).hasSize(2);
        assertThat(jdbcTemplate.sqls().get(0))
                .contains("ROW_NUMBER() OVER (PARTITION BY [ID]")
                .contains("WHERE [__rn] = 1")
                .contains("[Solicitacao] >= :dataInicio AND [Solicitacao] < :dataFimExclusivo");
        assertThat(jdbcTemplate.sqls().get(1))
                .contains("ROW_NUMBER() OVER (PARTITION BY [ID]")
                .contains("WHERE [__rn] = 1")
                .contains("ORDER BY [Solicitacao] DESC, [Coleta] DESC, [ID]")
                .contains("OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY")
                .containsOnlyOnce("[vw_coletas_powerbi]");
        assertThat(jdbcTemplate.params().get(1).getValue("offsetTabela")).isEqualTo(0L);
        assertThat(jdbcTemplate.params().get(1).getValue("tamanhoTabela")).isEqualTo(150);
    }

    @Test
    void buscarPrimeiraPaginaTrackingDeveUsarCountEOffsetFetchNativos() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("N° Minuta", 123L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        service.buscarPrimeiraPaginaTracking(filtroPadrao(), 200);

        assertThat(jdbcTemplate.sqls()).hasSize(2);
        assertThat(jdbcTemplate.sqls().get(0))
                .contains("SELECT COUNT(1)")
                .contains("FROM [vw_localizacao_cargas_powerbi] base_raw")
                .contains("[Data do frete] >= :inicioOffset AND [Data do frete] < :fimOffset");
        assertThat(jdbcTemplate.sqls().get(1))
                .contains("ORDER BY [Data do frete] DESC, [N° Minuta] DESC")
                .contains("OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY");
        assertThat(jdbcTemplate.params().get(1).getValue("tamanhoTabela")).isEqualTo(200);
    }

    @Test
    void buscarPrimeiraPaginaContasAPagarDeveUsarCountEOffsetFetchNativos() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Lançamento a Pagar/N°", 10L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        service.buscarPrimeiraPaginaContasAPagar(filtroPadrao(), 125);

        assertThat(jdbcTemplate.sqls()).hasSize(2);
        assertThat(jdbcTemplate.sqls().get(0))
                .contains("SELECT COUNT(1) FROM [vw_contas_a_pagar_powerbi] base")
                .contains("[Emissão] >= :dataInicio AND [Emissão] < :dataFimExclusivo");
        assertThat(jdbcTemplate.sqls().get(1))
                .contains("ORDER BY [Emissão] DESC, [Lançamento a Pagar/N°] DESC")
                .contains("OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY");
        assertThat(jdbcTemplate.params().get(1).getValue("tamanhoTabela")).isEqualTo(125);
    }

    @Test
    void buscarManifestosDeveMapearDadosConsolidadosDaView() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("Número", 62848L);
        row.put("Identificador Único", "62848_MDFE_4380");
        row.put("Receita Total Transportada", new BigDecimal("1000.25"));
        row.put("Capacidade Lotação Kg", new BigDecimal("12000.50"));
        row.put("Itens/Finalizados", 8);
        row.put("Itens/Total", 10);
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(row));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        ManifestoResumoDTO manifesto = service.buscarManifestos(filtroPadrao(), 1, 10).conteudo().get(0);

        assertThat(jdbcTemplate.sqls().get(1)).contains("SELECT * FROM [vw_fato_manifestos_dash] base");
        assertThat(manifesto.receitaTotalTransportada()).isEqualByComparingTo("1000.25");
        assertThat(manifesto.capacidadeKg()).isEqualByComparingTo("12000.50");
        assertThat(manifesto.itensFinalizados()).isEqualTo(8);
        assertThat(manifesto.itensTotal()).isEqualTo(10);
    }

    @Test
    void buscarManifestosDeveOrdenarPercentualRemuneracaoGlobalmenteNoSql() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Número", 62848L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        service.buscarManifestos(filtroPadrao(), 2, 10, "percentualRemuneracao", "desc");

        assertThat(jdbcTemplate.sqls().get(1))
                .contains("CASE WHEN (([Receita Total Transportada] > 0) OR ([Receita Total Transportada] = 0 AND [Custo total] > 0)) AND [Custo total] IS NOT NULL THEN 0 ELSE 1 END ASC")
                .contains("CASE WHEN [Receita Total Transportada] BETWEEN 0.01 AND 5.00 THEN 1 WHEN [Receita Total Transportada] = 0 AND [Custo total] > 0 THEN 1 ELSE ([Custo total] / NULLIF([Receita Total Transportada], 0)) END DESC")
                .contains("[Data criação] DESC")
                .contains("[Número] DESC")
                .contains("OFFSET :offsetTabela ROWS FETCH NEXT :tamanhoTabela ROWS ONLY");
        assertThat(jdbcTemplate.params().get(1).getValue("offsetTabela")).isEqualTo(10L);
    }

    @Test
    void buscarManifestosDeveFiltrarPorNumeroManifestoNoSql() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Número", 62848L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                Map.of("numeroManifesto", List.of("62848"))
        );

        service.buscarManifestos(filtro, 1, 10);

        assertThat(jdbcTemplate.sqls().get(0)).contains("[Número] = :filtro_numeroManifesto");
        assertThat(jdbcTemplate.sqls().get(1)).contains("[Número] = :filtro_numeroManifesto");
        assertThat(jdbcTemplate.params().get(1).getValue("filtro_numeroManifesto")).isEqualTo(62848L);
    }

    @Test
    void buscarManifestosDeveFiltrarPorClassificacaoNoSql() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Número", 62848L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                Map.of("classificacoes", List.of("Distribuição", "Transferência"))
        );

        service.buscarManifestos(filtro, 1, 10);

        assertThat(jdbcTemplate.sqls().get(0)).contains("[Classificação] IN (:filtro_classificacoes)");
        assertThat(jdbcTemplate.sqls().get(1)).contains("[Classificação] IN (:filtro_classificacoes)");
        assertThat(jdbcTemplate.params().get(1).getValue("filtro_classificacoes"))
                .isEqualTo(List.of("distribuição", "transferência"));
    }

    @Test
    void buscarManifestosDeveIgnorarNumeroManifestoInvalido() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Número", 62848L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                Map.of("numeroManifesto", List.of("62848A"))
        );

        service.buscarManifestos(filtro, 1, 10);

        assertThat(jdbcTemplate.sqls().get(0))
                .doesNotContain("[Número] = :filtro_numeroManifesto")
                .doesNotContain("1 = 0");
        assertThat(jdbcTemplate.sqls().get(1))
                .doesNotContain("[Número] = :filtro_numeroManifesto")
                .doesNotContain("1 = 0");
        assertThat(jdbcTemplate.params().get(1).hasValue("filtro_numeroManifesto")).isFalse();
    }

    @Test
    void buscarManifestosDeveOrdenarAproveitamentoEEfetividadeGlobalmenteNoSql() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Número", 62848L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        service.buscarManifestos(filtroPadrao(), 1, 10, "percentualAproveitamento", "asc");
        service.buscarManifestos(filtroPadrao(), 1, 10, "percentualEfetividade", "desc");

        assertThat(jdbcTemplate.sqls().get(1))
                .contains("CASE WHEN [Capacidade Lotação Kg] > 0 AND [Total peso taxado] IS NOT NULL THEN 0 ELSE 1 END ASC")
                .contains("[Total peso taxado] / NULLIF([Capacidade Lotação Kg], 0) ASC");
        assertThat(jdbcTemplate.sqls().get(3))
                .contains("CASE WHEN [Itens/Total] > 0 AND [Itens/Finalizados] IS NOT NULL THEN 0 ELSE 1 END ASC")
                .contains("CONVERT(DECIMAL(19, 6), [Itens/Finalizados]) / NULLIF([Itens/Total], 0) DESC");
    }

    @Test
    void buscarManifestosDeveIgnorarCampoDeOrdenacaoForaDaWhitelist() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate(List.of(linha("Número", 62848L)));
        DashboardTabelaPaginadaService service = service(jdbcTemplate);

        service.buscarManifestos(filtroPadrao(), 1, 10, "numero DESC; DROP TABLE x", "desc");

        assertThat(jdbcTemplate.sqls().get(1))
                .contains("ORDER BY [Data criação] DESC, [Número] DESC")
                .doesNotContain("DROP TABLE");
    }

    private static DashboardTabelaPaginadaService service(NamedParameterJdbcTemplate jdbcTemplate) {
        return new DashboardTabelaPaginadaService(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                new ValidadorPeriodoService(),
                escopoSemRestricao()
        );
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), Map.of());
    }

    private static Map<String, Object> linha(String coluna, Object valor) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put(coluna, valor);
        return row;
    }

    private static EscopoFilialService escopoSemRestricao() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }

    private static final class CapturandoJdbcTemplate extends NamedParameterJdbcTemplate {

        private final List<Map<String, Object>> linhas;
        private final List<String> sqls = new ArrayList<>();
        private final List<SqlParameterSource> params = new ArrayList<>();

        private CapturandoJdbcTemplate(List<Map<String, Object>> linhas) {
            super(new JdbcTemplate());
            this.linhas = linhas;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T queryForObject(String sql, SqlParameterSource paramSource, Class<T> requiredType) {
            sqls.add(sql);
            params.add(paramSource);
            if (requiredType == Long.class) {
                return (T) Long.valueOf(linhas.size());
            }
            return null;
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, SqlParameterSource paramSource) {
            sqls.add(sql);
            params.add(paramSource);
            return linhas;
        }

        private List<String> sqls() {
            return sqls;
        }

        private List<SqlParameterSource> params() {
            return params;
        }
    }
}
