package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.dimensoes.DimensaoOpcaoDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.CsvExportWriter;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DashboardExportServiceTest {

    private DashboardExportService service;

    @BeforeEach
    void setUp() {
        PeriodoOffsetDateTimeHelper periodoHelper = PeriodoOffsetDateTimeHelper.padrao();
        service = new DashboardExportService(
                null,
                new DashboardExportSqlBuilder(periodoHelper),
                new CsvExportWriter(),
                new ValidadorPeriodoService(),
                escopoComAcessoTotal()
        );
    }

    @Test
    void exportarDeveRetornarHeadersCsvComFilenameDoPeriodo() throws Exception {
        ResponseEntity<StreamingResponseBody> response = service.exportarBeans(
                "fretes",
                filtro(),
                List.of(new LinhaCsv("SPO", 10))
        );

        var contentType = Objects.requireNonNull(response.getHeaders().getContentType());
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        Objects.requireNonNull(response.getBody()).writeTo(outputStream);
        byte[] body = outputStream.toByteArray();
        String csv = new String(body, StandardCharsets.UTF_8);

        assertThat(contentType.toString()).isEqualTo("text/csv;charset=UTF-8");
        assertThat(response.getHeaders().getContentDisposition().isAttachment()).isTrue();
        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("fretes_2026-03-17_2026-04-16.csv");
        assertThat(response.getHeaders().getContentLength()).isEqualTo(body.length);
        assertThat(body).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        assertThat(csv).isEqualTo("\ufefffilial;total\r\nSPO;10\r\n");
    }

    @Test
    void listarUsuariosCotacoesUsaUsuarioKeyComoValorEUsuarioComoLabelPreferencial() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate();
        DashboardExportService serviceComJdbc = serviceComJdbc(jdbcTemplate);

        List<DimensaoOpcaoDTO> usuarios = serviceComJdbc.listarUsuariosCotacoes(filtro());

        assertThat(usuarios).singleElement().satisfies(usuario -> {
            assertThat(usuario.value()).isEqualTo("gabriele souza - comercial (mtz)");
            assertThat(usuario.label()).isEqualTo("Gabriele Souza - Comercial (MTZ)");
        });
        assertThat(jdbcTemplate.ultimoSql)
                .contains("[Usuario Key]")
                .contains("[Usuário]")
                .contains("[Solicitante]");
        assertThat(jdbcTemplate.ultimoSql.indexOf("[Usuário]"))
                .isLessThan(jdbcTemplate.ultimoSql.indexOf("[Solicitante]"));
    }

    @Test
    void listarClassificacoesCotacoesUsaTipoOperacaoEIgnoraFiltroAtual() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate();
        DashboardExportService serviceComJdbc = serviceComJdbc(jdbcTemplate);

        List<DimensaoOpcaoDTO> opcoes = serviceComJdbc.listarClassificacoesCotacoes(filtroCotacoesComDimensoes());

        assertThat(opcoes).singleElement().satisfies(opcao -> {
            assertThat(opcao.value()).isNotBlank();
            assertThat(opcao.label()).isNotBlank();
        });
        assertThat(jdbcTemplate.ultimoSql)
                .contains("[Tipo de operação]")
                .contains("FROM [vw_cotacoes_powerbi] base")
                .doesNotContain(":filtro_classificacoes")
                .contains(":filtro_origens")
                .contains(":filtro_destinos");
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_classificacoes")).isFalse();
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_origens")).isTrue();
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_destinos")).isTrue();
    }

    @Test
    void listarOrigensCotacoesUsaOrigemEIgnoraFiltroAtual() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate();
        DashboardExportService serviceComJdbc = serviceComJdbc(jdbcTemplate);

        serviceComJdbc.listarOrigensCotacoes(filtroCotacoesComDimensoes());

        assertThat(jdbcTemplate.ultimoSql)
                .contains("[Origem]")
                .contains("FROM [vw_cotacoes_powerbi] base")
                .doesNotContain(":filtro_origens")
                .contains(":filtro_classificacoes")
                .contains(":filtro_destinos");
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_origens")).isFalse();
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_classificacoes")).isTrue();
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_destinos")).isTrue();
    }

    @Test
    void listarDestinosCotacoesUsaDestinoEIgnoraFiltroAtual() {
        CapturandoJdbcTemplate jdbcTemplate = new CapturandoJdbcTemplate();
        DashboardExportService serviceComJdbc = serviceComJdbc(jdbcTemplate);

        serviceComJdbc.listarDestinosCotacoes(filtroCotacoesComDimensoes());

        assertThat(jdbcTemplate.ultimoSql)
                .contains("[Destino]")
                .contains("FROM [vw_cotacoes_powerbi] base")
                .doesNotContain(":filtro_destinos")
                .contains(":filtro_classificacoes")
                .contains(":filtro_origens");
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_destinos")).isFalse();
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_classificacoes")).isTrue();
        assertThat(jdbcTemplate.ultimoParamSource.hasValue("filtro_origens")).isTrue();
    }

    @Test
    void exportacaoPreservaTempoLimiteDoBanco() {
        var timeout = new QueryTimeoutException("tempo limite");
        var jdbc = new NamedParameterJdbcTemplate(new JdbcTemplate()) {
            @Override
            public <T> T query(String sql, SqlParameterSource params, ResultSetExtractor<T> resultSet) {
                throw timeout;
            }
        };
        assertThatThrownBy(() -> serviceComJdbc(jdbc).exportar(DashboardExportDefinition.COLETAS, filtro()))
                .isSameAs(timeout);
    }

    private record LinhaCsv(String filial, int total) {
    }

    private static final class CapturandoJdbcTemplate extends NamedParameterJdbcTemplate {
        private String ultimoSql;
        private SqlParameterSource ultimoParamSource;

        private CapturandoJdbcTemplate() {
            super(new JdbcTemplate());
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> List<T> query(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            this.ultimoSql = sql;
            this.ultimoParamSource = paramSource;
            return (List<T>) List.of(new DimensaoOpcaoDTO(
                    "gabriele souza - comercial (mtz)",
                    "Gabriele Souza - Comercial (MTZ)"
            ));
        }
    }

    private static DashboardExportService serviceComJdbc(NamedParameterJdbcTemplate jdbcTemplate) {
        return new DashboardExportService(
                jdbcTemplate,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                new CsvExportWriter(),
                new ValidadorPeriodoService(),
                escopoComAcessoTotal()
        );
    }

    private static FiltroConsultaDTO filtro() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 3, 17), LocalDate.of(2026, 4, 16), Map.of());
    }

    private static FiltroConsultaDTO filtroCotacoesComDimensoes() {
        return new FiltroConsultaDTO(
                LocalDate.of(2026, 3, 17),
                LocalDate.of(2026, 4, 16),
                Map.of(
                        "classificacoes", List.of("FTL"),
                        "origens", List.of("Guarulhos - SP"),
                        "destinos", List.of("Recife - PE")
                )
        );
    }

    private static EscopoFilialService escopoComAcessoTotal() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }
}
