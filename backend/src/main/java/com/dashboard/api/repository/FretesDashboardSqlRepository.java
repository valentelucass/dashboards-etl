package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.model.VisaoFretesEntity;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class FretesDashboardSqlRepository {

    private static final ZoneOffset OFFSET_BRASILIA = ZoneOffset.ofHours(-3);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EscopoFilialService escopoFilialService;

    public FretesDashboardSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            EscopoFilialService escopoFilialService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.escopoFilialService = escopoFilialService;
    }

    public List<VisaoFretesEntity> buscarRegistros(FiltroConsultaDTO filtro) {
        QueryContext ctx = criarContexto(filtro);
        String sql = baseSql() + """
                SELECT *
                FROM fretes
                WHERE data_referencia_periodo >= :dataInicio
                  AND data_referencia_periodo < :dataFim
                """ + ctx.where() + """
                ORDER BY data_referencia_faturamento DESC, numero_minuta DESC, id DESC
                """;

        return jdbcTemplate.query(sql, ctx.params(), this::mapear);
    }

    private QueryContext criarContexto(FiltroConsultaDTO filtro) {
        QueryContext ctx = new QueryContext(
                new StringBuilder(),
                new MapSqlParameterSource(Map.of(
                        "dataInicio", filtro.dataInicio(),
                        "dataFim", filtro.dataFim().plusDays(1)
                ))
        );

        aplicarEscopo(ctx);
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "filiais", "filial_nome", filtro.valores("filiais"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "status", "status", filtro.valores("status"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "pagadores", "pagador_nome", filtro.valores("pagadores"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "ufOrigem", "origem_uf", filtro.valores("ufOrigem"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "ufDestino", "destino_uf", filtro.valores("ufDestino"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "tiposFrete", "tipo_frete", filtro.valores("tiposFrete"));
        adicionarFiltroTexto(ctx.whereBuilder(), ctx.params(), "modais", "modal", filtro.valores("modais"));
        return ctx;
    }

    private void aplicarEscopo(QueryContext ctx) {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        if (escopo.acessoTotal()) {
            return;
        }
        List<String> filiais = normalizar(escopo.filiaisOrdenadas());
        if (filiais.isEmpty()) {
            ctx.whereBuilder().append("\n AND 1 = 0");
            return;
        }
        ctx.params().addValue("escopoFiliais", filiais);
        ctx.whereBuilder().append("\n AND LOWER(filial_nome) IN (:escopoFiliais)");
    }

    private static void adicionarFiltroTexto(
            StringBuilder where,
            MapSqlParameterSource params,
            String chave,
            String campo,
            Collection<String> valores
    ) {
        List<String> normalizados = normalizar(valores);
        if (normalizados.isEmpty()) {
            return;
        }
        params.addValue(chave, normalizados);
        where.append("\n AND LOWER(").append(campo).append(") IN (:").append(chave).append(")");
    }

    private static String baseSql() {
        return """
                WITH fretes AS (
                    SELECT
                        frete_id AS id,
                        data_frete,
                        numero_minuta,
                        receita_bruta AS valor_total,
                        valor_frete AS subtotal,
                        volumes,
                        peso_taxado,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), pagador_nome))), '') AS pagador_nome,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), remetente_nome))), '') AS remetente_nome,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), destinatario_nome))), '') AS destinatario_nome,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), origem_uf))), '') AS origem_uf,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), destino_uf))), '') AS destino_uf,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), destino_cidade))), '') AS destino_cidade,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), filial_nome))), '') AS filial_nome,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), filial_nome))), '') AS filial_emissora,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), responsavel_regiao_destino))), '') AS responsavel_regiao_destino,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), classificacao_nome))), '') AS classificacao_nome,
                        CAST(NULL AS date) AS previsao_entrega,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), status_frete))), '') AS status,
                        CONVERT(INT, is_cortesia) AS cortesia_flag,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), tipo_frete))), '') AS tipo_frete,
                        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), modal))), '') AS modal,
                        numero_cte,
                        data_emissao_cte AS cte_emissao,
                        data_referencia_faturamento,
                        data_referencia_faturamento_date AS data_referencia_periodo,
                        CONVERT(INT, is_elegivel_faturamento) AS elegivel_faturamento,
                        cte_id,
                        nfse_number AS nfse_numero,
                        CAST(0 AS DECIMAL(18, 2)) AS valor_icms,
                        CAST(0 AS DECIMAL(18, 2)) AS valor_pis,
                        CAST(0 AS DECIMAL(18, 2)) AS valor_cofins,
                        snapshot_em AS data_extracao
                    FROM dbo.fato_fretes_faturamento
                    WHERE excluido_na_origem = 0
                )
                """;
    }

    private VisaoFretesEntity mapear(ResultSet rs, int rowNum) throws SQLException {
        return VisaoFretesEntity.criarParaPainel(
                longo(rs, "id"),
                offset(rs, "data_frete"),
                longo(rs, "numero_minuta"),
                decimal(rs, "valor_total"),
                decimal(rs, "subtotal"),
                inteiro(rs, "volumes"),
                decimal(rs, "peso_taxado"),
                texto(rs, "pagador_nome"),
                texto(rs, "remetente_nome"),
                texto(rs, "destinatario_nome"),
                texto(rs, "origem_uf"),
                texto(rs, "destino_uf"),
                texto(rs, "destino_cidade"),
                texto(rs, "filial_nome"),
                texto(rs, "filial_emissora"),
                texto(rs, "responsavel_regiao_destino"),
                texto(rs, "classificacao_nome"),
                data(rs, "previsao_entrega"),
                texto(rs, "status"),
                booleano(rs, "cortesia_flag"),
                texto(rs, "tipo_frete"),
                texto(rs, "modal"),
                inteiro(rs, "numero_cte"),
                offset(rs, "cte_emissao"),
                offset(rs, "data_referencia_faturamento"),
                booleano(rs, "elegivel_faturamento"),
                longo(rs, "cte_id"),
                inteiro(rs, "nfse_numero"),
                decimal(rs, "valor_icms"),
                decimal(rs, "valor_pis"),
                decimal(rs, "valor_cofins"),
                dataHora(rs, "data_extracao")
        );
    }

    private static List<String> normalizar(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private static String texto(ResultSet rs, String coluna) throws SQLException {
        return rs.getString(coluna);
    }

    private static BigDecimal decimal(ResultSet rs, String coluna) throws SQLException {
        return rs.getBigDecimal(coluna);
    }

    private static Integer inteiro(ResultSet rs, String coluna) throws SQLException {
        Object valor = rs.getObject(coluna);
        return valor instanceof Number number ? number.intValue() : null;
    }

    private static Long longo(ResultSet rs, String coluna) throws SQLException {
        Object valor = rs.getObject(coluna);
        return valor instanceof Number number ? number.longValue() : null;
    }

    private static Boolean booleano(ResultSet rs, String coluna) throws SQLException {
        Object valor = rs.getObject(coluna);
        if (valor == null) {
            return null;
        }
        if (valor instanceof Boolean bool) {
            return bool;
        }
        if (valor instanceof Number number) {
            return number.intValue() != 0;
        }
        String texto = valor.toString().trim();
        return "1".equals(texto) || "true".equalsIgnoreCase(texto) || "sim".equalsIgnoreCase(texto);
    }

    private static LocalDate data(ResultSet rs, String coluna) throws SQLException {
        java.sql.Date valor = rs.getDate(coluna);
        return valor != null ? valor.toLocalDate() : null;
    }

    private static LocalDateTime dataHora(ResultSet rs, String coluna) throws SQLException {
        Timestamp valor = rs.getTimestamp(coluna);
        return valor != null ? valor.toLocalDateTime() : null;
    }

    private static OffsetDateTime offset(ResultSet rs, String coluna) throws SQLException {
        LocalDateTime valor = dataHora(rs, coluna);
        return valor != null ? valor.atOffset(OFFSET_BRASILIA) : null;
    }

    private record QueryContext(
            StringBuilder whereBuilder,
            MapSqlParameterSource params
    ) {
        String where() {
            return whereBuilder.toString();
        }
    }
}
