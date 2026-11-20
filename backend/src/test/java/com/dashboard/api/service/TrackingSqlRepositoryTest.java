package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.tracking.TrackingOverviewDTO;
import com.dashboard.api.repository.TrackingSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
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

class TrackingSqlRepositoryTest {

    @Test
    void buscarOverviewDeveAgregarNoSqlEManterDataFreteSargable() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        TrackingSqlRepository repository = repository(jdbcTemplate);

        repository.buscarOverview(filtroPadrao());

        String sqlExecutado = String.join("\n", jdbcTemplate.sqls());
        assertThat(sqlExecutado)
                .contains("COUNT(1) AS total_cargas")
                .contains("SUM(CASE")
                .contains("AS previsao_vencida")
                .contains("AS pct_finalizado")
                .contains("base_raw.[Data do frete] >= :inicioOffset AND base_raw.[Data do frete] < :fimOffset")
                .contains("CAST([Previsão Entrega/Previsão de entrega] AS date) < :hoje AND [Status Terminal] = 0")
                .doesNotContain("TRY_CONVERT(datetimeoffset, [Data do frete])")
                .doesNotContain("TRY_CONVERT(date, [Previsão Entrega/Previsão de entrega])");
    }

    @Test
    void buscarSerieDeveAgruparStatusPorDataNoSql() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        TrackingSqlRepository repository = repository(jdbcTemplate);

        repository.buscarSerie(filtroPadrao());

        String sqlExecutado = String.join("\n", jdbcTemplate.sqls());
        assertThat(sqlExecutado)
                .contains("CAST([Data do frete] AS date) AS data_frete")
                .contains("SUM(CASE WHEN status_exibicao = N'No Armazém'")
                .contains("GROUP BY data_frete")
                .contains("ORDER BY data_frete")
                .doesNotContain("TRY_CONVERT(datetimeoffset, [Data do frete])");
    }

    @Test
    void buscarGraficosDeveAgruparStatusPrevisaoEValorPorRegiaoNoSql() {
        CapturandoNamedParameterJdbcTemplate jdbcTemplate = new CapturandoNamedParameterJdbcTemplate();
        TrackingSqlRepository repository = repository(jdbcTemplate);

        repository.buscarGraficos(filtroPadrao());

        String sqlExecutado = String.join("\n", jdbcTemplate.sqls());
        assertThat(sqlExecutado)
                .contains("GROUP BY")
                .contains("AS filial_atual")
                .contains("AS regiao_destino")
                .contains("COUNT(1) AS total")
                .contains("SUM(")
                .contains("base_raw.[Data do frete] >= :inicioOffset AND base_raw.[Data do frete] < :fimOffset")
                .doesNotContain("TRY_CONVERT(datetimeoffset, [Data do frete])");
    }

    private static TrackingSqlRepository repository(CapturandoNamedParameterJdbcTemplate jdbcTemplate) {
        return new TrackingSqlRepository(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao()
        );
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

    private static final class CapturandoNamedParameterJdbcTemplate extends NamedParameterJdbcTemplate {
        private final List<String> sqls = new ArrayList<>();
        private final List<String> colunas = List.of(
                "Status Normalizado",
                "Peso Taxado Decimal",
                "Valor NF Decimal",
                "Sigla Responsável Região Destino"
        );

        private CapturandoNamedParameterJdbcTemplate() {
            super(new JdbcTemplate());
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> List<T> queryForList(String sql, SqlParameterSource paramSource, Class<T> elementType) {
            sqls.add(sql);
            return (List<T>) colunas;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T queryForObject(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            sqls.add(sql);
            return (T) new TrackingOverviewDTO(
                    "2026-03-23T12:00:00",
                    0,
                    0,
                    0,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    0.0
            );
        }

        @Override
        public <T> List<T> query(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            sqls.add(sql);
            return List.of();
        }

        private List<String> sqls() {
            return sqls;
        }
    }
}
