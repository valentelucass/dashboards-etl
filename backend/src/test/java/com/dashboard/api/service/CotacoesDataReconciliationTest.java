package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.controller.CotacoesController;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.cotacoes.CotacaoResumoDTO;
import com.dashboard.api.dto.cotacoes.CotacoesResumoAgregadoDTO;
import com.dashboard.api.repository.CotacoesDashboardSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.CsvExportWriter;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.ParsedSql;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.util.LinkedMultiValueMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class CotacoesDataReconciliationTest {

    private static final ZoneId ZONE_ID = ZoneId.of(PeriodoOffsetDateTimeHelper.DEFAULT_ZONE_ID);

    private JdbcTemplate jdbcTemplate;
    private NamedParameterJdbcTemplate namedJdbc;
    private CotacoesController controller;

    @BeforeEach
    void setUp() {
        DataSource dataSource = dataSourceH2();
        jdbcTemplate = new JdbcTemplate(dataSource);
        namedJdbc = new H2CotacoesNamedParameterJdbcTemplate(dataSource);
        criarFuncoesCompatibilidadeSqlServer();
        criarVisaoCotacoesFake();

        CotacoesDashboardSqlRepository repository = new CotacoesDashboardSqlRepository(
                namedJdbc,
                new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()),
                escopoSemRestricao()
        );
        CotacoesService service = new CotacoesService(new ValidadorPeriodoService(), repository);
        controller = new CotacoesController(service);
    }

    @Test
    void resumosPorUsuarioEFilialDevemConvergirComAnaliticoLinhaALinha() {
        inserirCincoCotacoesControladas();

        LocalDate inicio = LocalDate.of(2026, 3, 1);
        LocalDate fim = LocalDate.of(2026, 3, 31);

        Totais analitico = totaisAnaliticos(inicio, fim);
        Totais porUsuario = totais(controller.resumoUsuario(inicio, fim, new LinkedMultiValueMap<>()).getBody());
        Totais porFilial = totais(controller.resumoFilial(inicio, fim, new LinkedMultiValueMap<>()).getBody());

        assertTotaisIguais(porUsuario, analitico);
        assertTotaisIguais(porFilial, analitico);
        assertTotaisIguais(porUsuario, porFilial);
    }

    @Test
    void resumoPorClienteDeveRetornarTop40OrdenadoPorVolumeECortarCauda() {
        inserirQuarentaECincoClientes();

        LocalDate inicio = LocalDate.of(2026, 3, 1);
        LocalDate fim = LocalDate.of(2026, 3, 31);

        List<CotacoesResumoAgregadoDTO> clientes = controller
                .resumoCliente(inicio, fim, new LinkedMultiValueMap<>())
                .getBody();
        Totais top40Clientes = totais(clientes);
        Totais totalGlobalFilial = totais(controller.resumoFilial(inicio, fim, new LinkedMultiValueMap<>()).getBody());

        assertThat(clientes).hasSize(40);
        assertThat(clientes)
                .extracting(CotacoesResumoAgregadoDTO::entidade)
                .containsExactlyElementsOf(IntStream.rangeClosed(6, 45)
                        .map(i -> 51 - i)
                        .mapToObj(i -> "Cliente %03d".formatted(i))
                        .toList());
        assertThat(volumes(clientes)).isSortedAccordingTo((a, b) -> b.compareTo(a));
        assertThat(top40Clientes.totalCotacoes()).isEqualTo(40);
        assertThat(top40Clientes.volumeM3()).isLessThan(totalGlobalFilial.volumeM3());
        assertThat(top40Clientes.freteCotado()).isLessThan(totalGlobalFilial.freteCotado());
        assertThat(top40Clientes.totalCotacoes()).isLessThan(totalGlobalFilial.totalCotacoes());
    }

    @Test
    void filtroGlobalDePeriodoDeveExcluirCotacoesForaDoRangeSemContagemFantasma() {
        inserirCincoCotacoesControladas();
        inserirCotacao(
                1999L,
                LocalDate.of(2026, 2, 28),
                "SPO",
                "ana",
                "Ana",
                "Ana",
                "DOC-FORA-ANTES",
                "Cliente Fora Antes",
                "Cliente Fora Antes",
                "Convertida",
                "999.99",
                "99.99"
        );
        inserirCotacao(
                2000L,
                LocalDate.of(2026, 4, 1),
                "CWB",
                "bia",
                "Bia",
                "Bia",
                "DOC-FORA-DEPOIS",
                "Cliente Fora Depois",
                "Cliente Fora Depois",
                "Convertida",
                "888.88",
                "88.88"
        );

        LocalDate inicio = LocalDate.of(2026, 3, 10);
        LocalDate fim = LocalDate.of(2026, 3, 12);

        Totais analiticoFiltrado = totaisAnaliticos(inicio, fim);
        Totais porUsuario = totais(controller.resumoUsuario(inicio, fim, new LinkedMultiValueMap<>()).getBody());
        Totais porFilial = totais(controller.resumoFilial(inicio, fim, new LinkedMultiValueMap<>()).getBody());

        assertThat(analiticoFiltrado.totalCotacoes()).isEqualTo(3);
        assertThat(analiticoFiltrado.freteCotado()).isEqualByComparingTo("600.60");
        assertThat(analiticoFiltrado.volumeM3()).isEqualByComparingTo("7.50");
        assertTotaisIguais(porUsuario, analiticoFiltrado);
        assertTotaisIguais(porFilial, analiticoFiltrado);
    }

    @Test
    void resumeDoisTrechosComMesmoNumeroSemPerderFreteCotado() {
        LocalDate dia = LocalDate.of(2026, 3, 10);
        inserirCotacao(8888L, dia, "SPO", "ana", "Ana", "Ana",
                "DOC-TESTE", "Cliente Teste", "Cliente Teste", "Convertida", "100.25", "1.00");
        inserirCotacao(8888L, dia, "SPO", "ana", "Ana", "Ana",
                "DOC-TESTE", "Cliente Teste", "Cliente Teste", "Pendente", "200.50", "2.00");
        jdbcTemplate.update("""
                UPDATE [vw_cotacoes_powerbi]
                SET [Trecho] = CASE WHEN [Valor frete] = 100.25 THEN 'PR x Destino A' ELSE 'PR x Destino B' END
                WHERE [N° Cotação] = 8888
                """);

        Totais resumo = totais(controller.resumoFilial(dia, dia, new LinkedMultiValueMap<>()).getBody());
        assertThat(resumo.totalCotacoes()).isEqualTo(2);
        assertThat(resumo.freteCotado()).isEqualByComparingTo("300.75");
        assertTotaisIguais(resumo, totaisAnaliticos(dia, dia));
    }

    @Test
    void consultaEPaginaDuasCargasNaMesmaRotaComMesmoNumero() throws Exception {
        LocalDate dia = LocalDate.of(2026, 3, 10);
        inserirCotacao(8889L, dia, "SPO", "ana", "Ana", "Ana",
                "DOC-TESTE", "Cliente Teste", "Cliente Teste", "Pendente", "418.23", "1.00");
        inserirCotacao(8889L, dia, "SPO", "ana", "Ana", "Ana",
                "DOC-TESTE", "Cliente Teste", "Cliente Teste", "Pendente", "1474.34", "2.00");
        jdbcTemplate.update("""
                UPDATE [vw_cotacoes_powerbi]
                SET [Trecho] = 'Origem A x Destino B', [Metadata] = CAST([Volume] AS NVARCHAR(32))
                WHERE [N° Cotação] = 8889
                """);

        MockMvcBuilders.standaloneSetup(controller).build()
                .perform(get("/api/painel/cotacoes/resumo/filial")
                        .param("dataInicio", dia.toString()).param("dataFim", dia.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].totalCotacoes").value(2))
                .andExpect(jsonPath("$[0].freteCotado").value(1892.57));
        Totais resumo = totais(controller.resumoFilial(dia, dia, new LinkedMultiValueMap<>()).getBody());
        assertThat(resumo.totalCotacoes()).isEqualTo(2);
        assertThat(resumo.freteCotado()).isEqualByComparingTo("1892.57");
        assertThat(resumo.volumeM3()).isEqualByComparingTo("3.00");
        assertTotaisIguais(resumo, totaisAnaliticos(dia, dia));

        var builder = new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao());
        var periodo = new ValidadorPeriodoService();
        var escopo = escopoSemRestricao();
        var filtro = new FiltroConsultaDTO(dia, dia, Map.of());
        var paginacao = new DashboardTabelaPaginadaService(namedJdbc, builder, periodo, escopo);
        var primeira = paginacao.buscarCotacoes(filtro, 1, 1);
        var segunda = paginacao.buscarCotacoes(filtro, 2, 1);
        assertThat(primeira.totalElementos()).isEqualTo(2);
        assertThat(segunda.totalElementos()).isEqualTo(2);
        assertThat(primeira.conteudo()).hasSize(1);
        assertThat(segunda.conteudo()).hasSize(1);
        var itens = List.of(primeira.conteudo().get(0), segunda.conteudo().get(0));
        assertThat(itens).extracting(CotacaoResumoDTO::trecho).containsOnly("Origem A x Destino B");
        assertThat(itens).extracting(item -> item.valorFrete().stripTrailingZeros())
                .containsExactlyInAnyOrder(new BigDecimal("418.23"), new BigDecimal("1474.34"));
        assertThat(primeira.conteudo()).isEqualTo(paginacao.buscarCotacoes(filtro, 1, 1).conteudo());

        var exportacao = new DashboardExportService(namedJdbc, builder, new CsvExportWriter(), periodo, escopo);
        var arquivo = new ByteArrayOutputStream();
        exportacao.exportar(DashboardExportDefinition.COTACOES, filtro).getBody().writeTo(arquivo);
        assertThat(arquivo.toString(StandardCharsets.UTF_8).lines().skip(1).toList()).hasSize(2)
                .allSatisfy(linha -> assertThat(linha).contains("8889"));
    }

    private DataSource dataSourceH2() {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:cotacoes-reconciliation-" + UUID.randomUUID()
                + ";MODE=MSSQLServer;DATABASE_TO_UPPER=FALSE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }

    private void criarFuncoesCompatibilidadeSqlServer() {
        jdbcTemplate.execute("""
                CREATE ALIAS IF NOT EXISTS TRY_CONVERT FOR
                "com.dashboard.api.service.CotacoesDataReconciliationTest.tryConvert"
                """);
        jdbcTemplate.execute("""
                CREATE ALIAS IF NOT EXISTS DECIMAL FOR
                "com.dashboard.api.service.CotacoesDataReconciliationTest.decimalType"
                """);
        jdbcTemplate.execute("""
                CREATE ALIAS IF NOT EXISTS NCHAR FOR
                "com.dashboard.api.service.CotacoesDataReconciliationTest.nchar"
                """);
    }

    public static BigDecimal tryConvert(String tipoSql, String valor) {
        if (tipoSql == null || valor == null || !tipoSql.toLowerCase().startsWith("decimal")) {
            return null;
        }

        String normalizado = valor.trim();
        if (normalizado.isBlank()) {
            return null;
        }

        if (normalizado.contains(",")) {
            normalizado = normalizado.replace(".", "").replace(",", ".");
        }

        try {
            return new BigDecimal(normalizado);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static String decimalType(int precision, int scale) {
        return "DECIMAL(" + precision + "," + scale + ")";
    }

    public static String nchar(int codigo) {
        return String.valueOf((char) codigo);
    }

    private void criarVisaoCotacoesFake() {
        jdbcTemplate.execute("""
                CREATE TABLE [vw_cotacoes_powerbi] (
                    [N° Cotação] BIGINT NOT NULL,
                    [Data Cotação] TIMESTAMP WITH TIME ZONE NOT NULL,
                    [Data de extracao] TIMESTAMP NOT NULL,
                    [Status Conversão] NVARCHAR(100),
                    [Trecho] NVARCHAR(255),
                    [Metadata] NVARCHAR(255),
                    [Valor frete] DECIMAL(19,4),
                    [Volume] DECIMAL(19,4),
                    [Usuario Key] NVARCHAR(255),
                    [Usuário] NVARCHAR(255),
                    [Solicitante] NVARCHAR(255),
                    [Filial] NVARCHAR(255),
                    [CNPJ/CPF Cliente] NVARCHAR(255),
                    [Cliente Pagador] NVARCHAR(255),
                    [Cliente] NVARCHAR(255),
                    [datetime2] NVARCHAR(32) DEFAULT 'datetime2',
                    [datetimeoffset] NVARCHAR(32) DEFAULT 'datetimeoffset'
                )
                """);
    }

    private void inserirCincoCotacoesControladas() {
        inserirCotacao(1001L, LocalDate.of(2026, 3, 10), "SPO", "ana", "Ana", "Ana",
                "DOC-A", "Cliente A", "Cliente A", "Convertida", "100.10", "1.50");
        inserirCotacao(1002L, LocalDate.of(2026, 3, 11), "SPO", "ana", "Ana", "Ana",
                "DOC-B", "Cliente B", "Cliente B", "Reprovada", "200.20", "2.25");
        inserirCotacao(1003L, LocalDate.of(2026, 3, 12), "SPO", "bia", "Bia", "Bia",
                "DOC-C", "Cliente C", "Cliente C", "Em aberto", "300.30", "3.75");
        inserirCotacao(1004L, LocalDate.of(2026, 3, 13), "CWB", "bia", "Bia", "Bia",
                "DOC-A", "Cliente A", "Cliente A", "Convertido", "400.40", "4.00");
        inserirCotacao(1005L, LocalDate.of(2026, 3, 14), "CWB", "caio", "Caio", "Caio",
                "DOC-B", "Cliente B", "Cliente B", "Pendente", "500.50", "5.50");
    }

    private void inserirQuarentaECincoClientes() {
        IntStream.rangeClosed(1, 45).forEach(i -> inserirCotacao(
                3000L + i,
                LocalDate.of(2026, 3, 1).plusDays(i % 15),
                "SPO",
                "usuario-top",
                "Usuario Top",
                "Usuario Top",
                "DOC-%03d".formatted(i),
                "Cliente %03d".formatted(i),
                "Cliente %03d".formatted(i),
                "Em aberto",
                BigDecimal.valueOf(i * 10L).toPlainString(),
                BigDecimal.valueOf(i).toPlainString()
        ));
    }

    private void inserirCotacao(
            Long numeroCotacao,
            LocalDate dataCotacao,
            String filial,
            String usuarioKey,
            String usuario,
            String solicitante,
            String documentoCliente,
            String clientePagador,
            String cliente,
            String statusConversao,
            String valorFrete,
            String volume
    ) {
        OffsetDateTime data = dataCotacao.atTime(10, 0).atZone(ZONE_ID).toOffsetDateTime();
        jdbcTemplate.update("""
                INSERT INTO [vw_cotacoes_powerbi] (
                    [N° Cotação],
                    [Data Cotação],
                    [Data de extracao],
                    [Status Conversão],
                    [Valor frete],
                    [Volume],
                    [Usuario Key],
                    [Usuário],
                    [Solicitante],
                    [Filial],
                    [CNPJ/CPF Cliente],
                    [Cliente Pagador],
                    [Cliente]
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                numeroCotacao,
                data,
                data.toLocalDateTime().plusHours(1),
                statusConversao,
                new BigDecimal(valorFrete),
                new BigDecimal(volume),
                usuarioKey,
                usuario,
                solicitante,
                filial,
                documentoCliente,
                clientePagador,
                cliente
        );
    }

    private Totais totaisAnaliticos(LocalDate inicio, LocalDate fim) {
        OffsetDateTime inicioInclusivo = inicio.atStartOfDay(ZONE_ID).toOffsetDateTime();
        OffsetDateTime fimExclusivo = fim.plusDays(1).atStartOfDay(ZONE_ID).toOffsetDateTime();
        return jdbcTemplate.queryForObject("""
                SELECT
                    COUNT(1) AS total_cotacoes,
                    COALESCE(SUM([Valor frete]), 0) AS frete_cotado,
                    COALESCE(SUM([Volume]), 0) AS volume_m3
                FROM [vw_cotacoes_powerbi]
                WHERE [Data Cotação] >= ?
                  AND [Data Cotação] < ?
                """,
                (rs, rowNum) -> new Totais(
                        rs.getInt("total_cotacoes"),
                        decimal(rs.getBigDecimal("frete_cotado")),
                        decimal(rs.getBigDecimal("volume_m3"))
                ),
                inicioInclusivo,
                fimExclusivo
        );
    }

    private static Totais totais(List<CotacoesResumoAgregadoDTO> linhas) {
        assertThat(linhas).isNotNull();
        return new Totais(
                linhas.stream().mapToInt(CotacoesResumoAgregadoDTO::totalCotacoes).sum(),
                linhas.stream()
                        .map(CotacoesResumoAgregadoDTO::freteCotado)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .setScale(2, RoundingMode.HALF_UP),
                linhas.stream()
                        .map(CotacoesResumoAgregadoDTO::volumeM3)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .setScale(2, RoundingMode.HALF_UP)
        );
    }

    private static List<BigDecimal> volumes(List<CotacoesResumoAgregadoDTO> linhas) {
        assertThat(linhas).isNotNull();
        return linhas.stream()
                .map(CotacoesResumoAgregadoDTO::volumeM3)
                .toList();
    }

    private static void assertTotaisIguais(Totais atual, Totais esperado) {
        assertThat(atual.totalCotacoes()).isEqualTo(esperado.totalCotacoes());
        assertThat(atual.freteCotado()).isEqualByComparingTo(esperado.freteCotado());
        assertThat(atual.volumeM3()).isEqualByComparingTo(esperado.volumeM3());
    }

    private static BigDecimal decimal(BigDecimal valor) {
        return (valor == null ? BigDecimal.ZERO : valor).setScale(2, RoundingMode.HALF_UP);
    }

    private static EscopoFilialService escopoSemRestricao() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }

    private static class H2CotacoesNamedParameterJdbcTemplate extends NamedParameterJdbcTemplate {

        private static final DateTimeFormatter H2_TIMESTAMP_WITH_TIME_ZONE =
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ssxxx");

        H2CotacoesNamedParameterJdbcTemplate(DataSource dataSource) {
            super(dataSource);
        }

        @Override
        protected ParsedSql getParsedSql(String sql) {
            return super.getParsedSql(sql.replace(
                    "HASHBYTES('SHA2_256', CONVERT(varbinary(max), [Metadata]))",
                    "HASH('SHA-256', STRINGTOUTF8([Metadata]))"));
        }

        @Override
        public <T> List<T> query(String sql, SqlParameterSource paramSource, RowMapper<T> rowMapper) {
            return super.query(injetarLiteraisPeriodoH2(sql, paramSource), paramSource, rowMapper);
        }

        private static String injetarLiteraisPeriodoH2(String sql, SqlParameterSource paramSource) {
            if (paramSource == null
                    || !paramSource.hasValue("inicioOffset")
                    || !paramSource.hasValue("fimOffset")) {
                return sql;
            }

            return sql
                    .replace(":inicioOffset", literalTimestampWithTimeZone(paramSource.getValue("inicioOffset")))
                    .replace(":fimOffset", literalTimestampWithTimeZone(paramSource.getValue("fimOffset")));
        }

        private static String literalTimestampWithTimeZone(Object valor) {
            OffsetDateTime data = (OffsetDateTime) valor;
            return "TIMESTAMP WITH TIME ZONE '" + data.format(H2_TIMESTAMP_WITH_TIME_ZONE) + "'";
        }
    }

    private record Totais(int totalCotacoes, BigDecimal freteCotado, BigDecimal volumeM3) {
    }
}
