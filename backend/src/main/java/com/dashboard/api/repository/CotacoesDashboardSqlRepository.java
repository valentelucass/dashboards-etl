package com.dashboard.api.repository;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.cotacoes.CotacaoResumoDTO;
import com.dashboard.api.dto.cotacoes.CotacoesAgrupamentoDTO;
import com.dashboard.api.dto.cotacoes.CotacoesChartsDTO;
import com.dashboard.api.dto.cotacoes.CotacoesCorredorValiosoDTO;
import com.dashboard.api.dto.cotacoes.CotacoesFunilDTO;
import com.dashboard.api.dto.cotacoes.CotacoesMotivoPerdaDTO;
import com.dashboard.api.dto.cotacoes.CotacoesOverviewDTO;
import com.dashboard.api.dto.cotacoes.CotacoesResumoAgregadoDTO;
import com.dashboard.api.dto.cotacoes.CotacoesTrendPointDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Arrays;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class CotacoesDashboardSqlRepository {

    private static final String STATUS_NORMALIZADO_SQL =
            "LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status Conversão]))))";
    private static final String STATUS_CONVERTIDA_SQL =
            "status_normalizado IN (N'convertida', N'convertido')";
    private static final String STATUS_REPROVADA_SQL =
            "status_normalizado IN (N'reprovada', N'reprovado', N'perdida', N'perdido')";
    private static final String STATUS_EM_ABERTO_SQL =
            "(status_normalizado IS NULL OR status_normalizado NOT IN (N'convertida', N'convertido', N'reprovada', N'reprovado', N'perdida', N'perdido'))";

    private final NamedParameterJdbcOperations jdbcTemplate;
    private final DashboardExportSqlBuilder sqlBuilder;
    private final EscopoFilialService escopoFilialService;

    public CotacoesDashboardSqlRepository(
            NamedParameterJdbcOperations jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder,
            EscopoFilialService escopoFilialService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.sqlBuilder = sqlBuilder;
        this.escopoFilialService = escopoFilialService;
    }

    public CotacoesOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.COTACOES,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );

        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        COALESCE(TRY_CONVERT(DECIMAL(19,4), [Valor frete]), 0) AS valor_frete,
                        COALESCE(TRY_CONVERT(DECIMAL(19,4), [Peso taxado]), 0) AS peso_taxado,
                        TRY_CONVERT(datetimeoffset, CONVERT(NVARCHAR(64), [Data Cotação])) AS data_cotacao,
                        TRY_CONVERT(datetimeoffset, CONVERT(NVARCHAR(64), [CT-e/Data de emissão])) AS cte_emissao,
                        TRY_CONVERT(datetimeoffset, CONVERT(NVARCHAR(64), [Nfse/Data de emissão])) AS nfse_emissao,
                        TRY_CONVERT(datetime2, CONVERT(NVARCHAR(64), [Data de extracao])) AS data_extracao,
                        %s AS status_normalizado
                    FROM base_filtrada
                ),
                agregado AS (
                    SELECT
                        MAX(data_extracao) AS updated_at,
                        COUNT(1) AS total_cotacoes,
                        SUM(valor_frete) AS valor_potencial,
                        SUM(CASE WHEN %s THEN valor_frete ELSE 0 END) AS valor_convertido,
                        SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS convertidas,
                        SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS reprovadas,
                        SUM(CASE WHEN peso_taxado > 0 THEN peso_taxado ELSE 0 END) AS peso_taxado_valido,
                        SUM(CASE WHEN peso_taxado > 0 THEN valor_frete ELSE 0 END) AS valor_frete_peso,
                        SUM(CASE WHEN %s AND cte_emissao IS NOT NULL THEN 1 ELSE 0 END) AS convertidas_com_cte,
                        SUM(CASE WHEN nfse_emissao IS NOT NULL THEN 1 ELSE 0 END) AS cotacoes_com_nfse,
                        AVG(CASE
                            WHEN cte_emissao IS NOT NULL AND data_cotacao IS NOT NULL
                            THEN CAST(DATEDIFF(HOUR, data_cotacao, cte_emissao) AS FLOAT)
                        END) AS tempo_medio_conversao_horas
                    FROM base_metricas
                )
                SELECT
                    updated_at,
                    total_cotacoes,
                    CAST(COALESCE(valor_potencial, 0) AS DECIMAL(19,2)) AS valor_potencial,
                    CAST(COALESCE(valor_convertido, 0) AS DECIMAL(19,2)) AS valor_convertido,
                    CAST(COALESCE(valor_potencial / NULLIF(total_cotacoes, 0), 0) AS DECIMAL(19,2)) AS frete_medio,
                    CAST(COALESCE(valor_frete_peso / NULLIF(peso_taxado_valido, 0), 0) AS DECIMAL(19,2)) AS frete_kg_medio,
                    CAST(COALESCE(valor_convertido * 100.0 / NULLIF(valor_potencial, 0), 0) AS DECIMAL(19,2)) AS conversao_valor,
                    CAST(COALESCE(CAST(convertidas AS FLOAT) * 100.0 / NULLIF(total_cotacoes, 0), 0) AS DECIMAL(19,2)) AS conversao_quantidade,
                    CAST(COALESCE(CAST(reprovadas AS FLOAT) * 100.0 / NULLIF(total_cotacoes, 0), 0) AS DECIMAL(19,2)) AS reprovacao_percentual,
                    CAST(COALESCE(CAST(convertidas_com_cte AS FLOAT) * 100.0 / NULLIF(total_cotacoes, 0), 0) AS DECIMAL(19,2)) AS taxa_conversao_cte,
                    CAST(COALESCE(CAST(cotacoes_com_nfse AS FLOAT) * 100.0 / NULLIF(total_cotacoes, 0), 0) AS DECIMAL(19,2)) AS taxa_conversao_nfse,
                    CAST(COALESCE(tempo_medio_conversao_horas, 0) AS DECIMAL(19,2)) AS tempo_medio_conversao_horas
                FROM agregado
                """.formatted(
                source.sql(),
                STATUS_NORMALIZADO_SQL,
                STATUS_CONVERTIDA_SQL,
                STATUS_CONVERTIDA_SQL,
                STATUS_REPROVADA_SQL,
                STATUS_CONVERTIDA_SQL
        );

        return jdbcTemplate.queryForObject(sql, copiarParams(source), (rs, rowNum) -> new CotacoesOverviewDTO(
                updatedAt(rs.getTimestamp("updated_at")),
                rs.getInt("total_cotacoes"),
                decimal(rs.getBigDecimal("valor_potencial")),
                decimal(rs.getBigDecimal("valor_convertido")),
                decimal(rs.getBigDecimal("frete_medio")),
                decimal(rs.getBigDecimal("frete_kg_medio")),
                percentual(rs.getBigDecimal("conversao_valor")),
                percentual(rs.getBigDecimal("conversao_quantidade")),
                percentual(rs.getBigDecimal("reprovacao_percentual")),
                percentual(rs.getBigDecimal("taxa_conversao_cte")),
                percentual(rs.getBigDecimal("taxa_conversao_nfse")),
                percentual(rs.getBigDecimal("tempo_medio_conversao_horas"))
        ));
    }

    public List<CotacoesTrendPointDTO> buscarSerie(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.COTACOES,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );

        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        CAST([Data Cotação] AS date) AS data_cotacao,
                        COALESCE(TRY_CONVERT(DECIMAL(19,4), [Valor frete]), 0) AS valor_frete,
                        %s AS status_normalizado
                    FROM base_filtrada
                    WHERE [Data Cotação] IS NOT NULL
                )
                SELECT
                    data_cotacao,
                    COUNT(1) AS total_cotacoes,
                    SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS convertidas,
                    SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS reprovadas,
                    CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS valor_potencial,
                    CAST(COALESCE(SUM(CASE WHEN %s THEN valor_frete ELSE 0 END), 0) AS DECIMAL(19,2)) AS valor_convertido
                FROM base_metricas
                GROUP BY data_cotacao
                ORDER BY data_cotacao
                """.formatted(
                source.sql(),
                STATUS_NORMALIZADO_SQL,
                STATUS_CONVERTIDA_SQL,
                STATUS_REPROVADA_SQL,
                STATUS_CONVERTIDA_SQL
        );

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new CotacoesTrendPointDTO(
                data(rs.getDate("data_cotacao")),
                rs.getInt("total_cotacoes"),
                rs.getInt("convertidas"),
                rs.getInt("reprovadas"),
                decimal(rs.getBigDecimal("valor_potencial")),
                decimal(rs.getBigDecimal("valor_convertido"))
        ));
    }

    public CotacoesChartsDTO buscarGraficos(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.COTACOES,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );

        return new CotacoesChartsDTO(
              buscarFunil(source),
              buscarCorredoresMaisValiosos(source),
              buscarPerdas(source, "motivo_perda", "motivo"),
              buscarAgrupamentos(source, "trecho", "nome"),
              buscarAgrupamentos(source, "uf_origem", "nome"),
              buscarAgrupamentos(source, "uf_destino", "nome"),
              buscarAgrupamentos(source, "tipo_operacao_normalizado", "nome"),
              buscarPerdas(source, "cliente_pagador", "motivo"),
              buscarPerdas(source, "trecho", "motivo")
        );
    }

    public List<CotacaoResumoDTO> buscarTabela(FiltroConsultaDTO filtro, int limite) {
        DashboardExportSqlBuilder.ExportSql source = sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.COTACOES,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );

        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        TRY_CONVERT(BIGINT, [N° Cotação]) AS numero_cotacao,
                        TRY_CONVERT(datetimeoffset, CONVERT(NVARCHAR(64), [Data Cotação])) AS data_cotacao,
                        %s AS filial,
                        %s AS solicitante,
                        %s AS cliente_pagador,
                        %s AS cliente,
                        %s AS trecho,
                        %s AS valor_frete,
                        %s AS status_conversao,
                        %s AS motivo_perda,
                        %s AS tipo_operacao,
                        TRY_CONVERT(INT, %s) AS volumes,
                        %s AS peso_taxado,
                        %s AS min_frete_kg,
                        %s AS valor_nf,
                        %s AS tabela,
                        %s AS origem,
                        %s AS cidade_origem,
                        %s AS uf_origem,
                        %s AS destino,
                        %s AS cidade_destino,
                        %s AS uf_destino,
                        TRY_CONVERT(datetimeoffset, CONVERT(NVARCHAR(64), [CT-e/Data de emissão])) AS cte_emissao,
                        TRY_CONVERT(datetimeoffset, CONVERT(NVARCHAR(64), [Nfse/Data de emissão])) AS nfse_emissao,
                        HASHBYTES('SHA2_256', CONVERT(varbinary(max), [Metadata])) AS ordem_linha
                    FROM base_filtrada
                )
                SELECT
                    numero_cotacao,
                    data_cotacao,
                    filial,
                    solicitante,
                    cliente_pagador,
                    cliente,
                    trecho,
                    CAST(valor_frete AS DECIMAL(19,2)) AS valor_frete,
                    status_conversao,
                    motivo_perda,
                    tipo_operacao,
                    volumes,
                    CAST(peso_taxado AS DECIMAL(19,2)) AS peso_taxado,
                    CAST(CASE WHEN peso_taxado > 0 THEN valor_frete / peso_taxado ELSE 0 END AS DECIMAL(19,2)) AS frete_por_kg,
                    CAST(min_frete_kg AS DECIMAL(19,2)) AS min_frete_kg,
                    CAST(valor_nf AS DECIMAL(19,2)) AS valor_nf,
                    CAST(CASE WHEN valor_nf > 0 THEN (valor_frete * 100) / valor_nf ELSE 0 END AS DECIMAL(19,2)) AS percentual_nf,
                    tabela,
                    COALESCE(origem, CASE
                        WHEN cidade_origem IS NULL AND uf_origem IS NULL THEN NULL
                        WHEN cidade_origem IS NULL THEN uf_origem
                        WHEN uf_origem IS NULL THEN cidade_origem
                        ELSE cidade_origem + N' - ' + uf_origem
                    END) AS origem,
                    COALESCE(destino, CASE
                        WHEN cidade_destino IS NULL AND uf_destino IS NULL THEN NULL
                        WHEN cidade_destino IS NULL THEN uf_destino
                        WHEN uf_destino IS NULL THEN cidade_destino
                        ELSE cidade_destino + N' - ' + uf_destino
                    END) AS destino,
                    cte_emissao,
                    nfse_emissao
                FROM base_metricas
                ORDER BY data_cotacao DESC, numero_cotacao DESC, trecho, ordem_linha
                OFFSET 0 ROWS FETCH NEXT :limite ROWS ONLY
                """.formatted(
                source.sql(),
                textoSql("[Filial]"),
                textoSql("[Solicitante]"),
                textoSql("[Cliente Pagador]"),
                textoSql("[Cliente]"),
                textoSql("[Trecho]"),
                decimalSql("[Valor frete]"),
                textoSql("[Status Conversão]"),
                textoSql("[Motivo Perda]"),
                textoSql("[Tipo de operação]"),
                nullableDecimalSql("[Volume]"),
                decimalSql("[Peso taxado]"),
                decimalSql("[Min. Frete/KG]"),
                decimalSql("[Valor NF]"),
                textoSql("[Tabela]"),
                textoSql("[Origem]"),
                textoSql("[Cidade Origem]"),
                textoSql("[UF Origem]"),
                textoSql("[Destino]"),
                textoSql("[Cidade Destino]"),
                textoSql("[UF Destino]")
        );

        MapSqlParameterSource params = copiarParams(source);
        params.addValue("limite", limite);
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new CotacaoResumoDTO(
                longOuNulo(rs, "numero_cotacao"),
                rs.getString("data_cotacao"),
                rs.getString("filial"),
                rs.getString("solicitante"),
                rs.getString("cliente_pagador"),
                rs.getString("cliente"),
                rs.getString("trecho"),
                decimal(rs.getBigDecimal("valor_frete")),
                rs.getString("status_conversao"),
                rs.getString("motivo_perda"),
                rs.getString("tipo_operacao"),
                inteiroOuNulo(rs, "volumes"),
                decimal(rs.getBigDecimal("peso_taxado")),
                decimal(rs.getBigDecimal("frete_por_kg")),
                decimal(rs.getBigDecimal("min_frete_kg")),
                decimal(rs.getBigDecimal("valor_nf")),
                decimal(rs.getBigDecimal("percentual_nf")),
                rs.getString("tabela"),
                rs.getString("origem"),
                rs.getString("destino"),
                rs.getString("cte_emissao"),
                rs.getString("nfse_emissao")
        ));
    }

    public List<CotacoesResumoAgregadoDTO> buscarResumoPorUsuario(FiltroConsultaDTO filtro) {
        return buscarResumoAgrupado(
                filtro,
                coalesceTextoSql("N'Sem usuario'", "[Usuario Key]", "[Usuário]", "[Solicitante]"),
                coalesceTextoSql("N'Sem usuario'", "[Usuário]", "[Solicitante]", "[Usuario Key]"),
                null,
                "total_cotacoes DESC, entidade"
        );
    }

    public List<CotacoesResumoAgregadoDTO> buscarResumoPorFilial(FiltroConsultaDTO filtro) {
        return buscarResumoAgrupado(
                filtro,
                coalesceTextoSql("N'Sem filial'", "[Filial]"),
                coalesceTextoSql("N'Sem filial'", "[Filial]"),
                null,
                "total_cotacoes DESC, entidade"
        );
    }

    public List<CotacoesResumoAgregadoDTO> buscarResumoPorCliente(FiltroConsultaDTO filtro) {
        return buscarResumoAgrupado(
                filtro,
                coalesceTextoSql("N'Sem cliente'", "[CNPJ/CPF Cliente]", "[Cliente Pagador]", "[Cliente]"),
                coalesceTextoSql("N'Sem cliente'", "[Cliente Pagador]", "[Cliente]", "[CNPJ/CPF Cliente]"),
                40,
                "volume_m3 DESC, total_cotacoes DESC, entidade"
        );
    }

    private List<CotacoesResumoAgregadoDTO> buscarResumoAgrupado(
            FiltroConsultaDTO filtro,
            String agrupadorIdSql,
            String entidadeSql,
            Integer limite,
            String orderBy
    ) {
        DashboardExportSqlBuilder.ExportSql source = sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.COTACOES,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );

        String topSql = limite == null ? "" : "TOP (%d) ".formatted(limite);
        String sql = """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        %s AS agrupador_id,
                        %s AS entidade,
                        %s AS status_normalizado,
                        %s AS valor_frete,
                        %s AS volume_m3
                    FROM base_filtrada
                ),
                agregado AS (
                    SELECT
                        agrupador_id,
                        MIN(entidade) AS entidade,
                        COUNT(1) AS total_cotacoes,
                        SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS ganhas,
                        SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS em_aberto,
                        CAST(COALESCE(CAST(SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS FLOAT) * 100.0 / NULLIF(COUNT(1), 0), 0) AS DECIMAL(19,2)) AS taxa_conversao,
                        CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS frete_cotado,
                        CAST(COALESCE(SUM(CASE WHEN %s THEN valor_frete ELSE 0 END), 0) AS DECIMAL(19,2)) AS frete_ganho,
                        CAST(COALESCE(SUM(volume_m3), 0) AS DECIMAL(19,2)) AS volume_m3
                    FROM base_metricas
                    GROUP BY agrupador_id
                )
                SELECT %s
                    agrupador_id,
                    entidade,
                    total_cotacoes,
                    ganhas,
                    em_aberto,
                    taxa_conversao,
                    frete_cotado,
                    frete_ganho,
                    volume_m3
                FROM agregado
                ORDER BY %s
                """.formatted(
                source.sql(),
                agrupadorIdSql,
                entidadeSql,
                STATUS_NORMALIZADO_SQL,
                decimalSql("[Valor frete]"),
                decimalSql("[Volume]"),
                STATUS_CONVERTIDA_SQL,
                STATUS_EM_ABERTO_SQL,
                STATUS_CONVERTIDA_SQL,
                STATUS_CONVERTIDA_SQL,
                topSql,
                orderBy
        );

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new CotacoesResumoAgregadoDTO(
                rs.getString("agrupador_id"),
                rs.getString("entidade"),
                rs.getInt("total_cotacoes"),
                rs.getInt("ganhas"),
                rs.getInt("em_aberto"),
                percentual(rs.getBigDecimal("taxa_conversao")),
                decimal(rs.getBigDecimal("frete_cotado")),
                decimal(rs.getBigDecimal("frete_ganho")),
                decimal(rs.getBigDecimal("volume_m3"))
        ));
    }

    private List<CotacoesFunilDTO> buscarFunil(DashboardExportSqlBuilder.ExportSql source) {
        String sql = baseMetricasSql(source) + """
                SELECT
                    status_exibicao AS etapa,
                    COUNT(1) AS total,
                    CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS valor
                FROM base_metricas
                GROUP BY status_exibicao
                ORDER BY total DESC, etapa
                """;

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new CotacoesFunilDTO(
                rs.getString("etapa"),
                rs.getInt("total"),
                decimal(rs.getBigDecimal("valor"))
        ));
    }

    private List<CotacoesCorredorValiosoDTO> buscarCorredoresMaisValiosos(DashboardExportSqlBuilder.ExportSql source) {
        String sql = baseMetricasSql(source) + """
                SELECT TOP (10)
                    trecho,
                    CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS valor_frete,
                    COUNT(1) AS cotacoes
                FROM base_metricas
                GROUP BY trecho
                ORDER BY valor_frete DESC, trecho
                """;

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new CotacoesCorredorValiosoDTO(
                rs.getString("trecho"),
                decimal(rs.getBigDecimal("valor_frete")),
                rs.getInt("cotacoes")
        ));
    }

    private List<CotacoesMotivoPerdaDTO> buscarPerdas(
            DashboardExportSqlBuilder.ExportSql source,
            String campo,
            String alias
    ) {
        String sql = baseMetricasSql(source) + """
                SELECT TOP (10)
                    %1$s AS %2$s,
                    COUNT(1) AS total
                FROM base_metricas
                WHERE %3$s
                GROUP BY %1$s
                ORDER BY total DESC, %1$s
                """.formatted(campo, alias, STATUS_REPROVADA_SQL);

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new CotacoesMotivoPerdaDTO(
                rs.getString(alias),
                rs.getInt("total")
        ));
    }

    private List<CotacoesAgrupamentoDTO> buscarAgrupamentos(
            DashboardExportSqlBuilder.ExportSql source,
            String campo,
            String alias
    ) {
        String sql = baseMetricasSql(source) + """
                SELECT TOP (10)
                    %1$s AS %2$s,
                    CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)) AS valor_potencial,
                    CAST(COALESCE(SUM(CASE WHEN %3$s THEN valor_frete ELSE 0 END), 0) AS DECIMAL(19,2)) AS valor_convertido,
                    COUNT(1) AS cotacoes,
                    SUM(CASE WHEN %3$s THEN 1 ELSE 0 END) AS convertidas,
                    SUM(CASE WHEN %4$s THEN 1 ELSE 0 END) AS reprovadas
                FROM base_metricas
                GROUP BY %1$s
                ORDER BY valor_potencial DESC, %1$s
                """.formatted(campo, alias, STATUS_CONVERTIDA_SQL, STATUS_REPROVADA_SQL);

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new CotacoesAgrupamentoDTO(
                rs.getString(alias),
                decimal(rs.getBigDecimal("valor_potencial")),
                decimal(rs.getBigDecimal("valor_convertido")),
                rs.getInt("cotacoes"),
                rs.getInt("convertidas"),
                rs.getInt("reprovadas")
        ));
    }

    private String baseMetricasSql(DashboardExportSqlBuilder.ExportSql source) {
        return """
                WITH base_filtrada AS (
                    SELECT *
                    %s
                ),
                base_metricas AS (
                    SELECT
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Status Conversão]))), N''), N'Sem status') AS status_exibicao,
                        %s AS status_normalizado,
                        %s AS valor_frete,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Trecho]))), N''), N'Sem trecho') AS trecho,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Motivo Perda]))), N''), N'Sem motivo') AS motivo_perda,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente Pagador]))), N''), N'Sem cliente') AS cliente_pagador,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), [UF Origem]))), N''), N'Sem UF origem') AS uf_origem,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), [UF Destino]))), N''), N'Sem UF destino') AS uf_destino,
                        %s AS tipo_operacao_normalizado
                    FROM base_filtrada
                )
                """.formatted(
                source.sql(),
                STATUS_NORMALIZADO_SQL,
                decimalSql("[Valor frete]"),
                tipoOperacaoNormalizadoSql()
        );
    }

    private static String decimalSql(String coluna) {
        String textoSemEspacos = "REPLACE(REPLACE(CONVERT(NVARCHAR(100), " + coluna + "), NCHAR(160), N''), N' ', N'')";
        return """
                COALESCE(
                    TRY_CONVERT(DECIMAL(19,4), %1$s),
                    TRY_CONVERT(DECIMAL(19,4), %2$s),
                    TRY_CONVERT(DECIMAL(19,4), REPLACE(REPLACE(%2$s, '.', ''), ',', '.')),
                    0
                )
                """.formatted(coluna, textoSemEspacos);
    }

    private static String nullableDecimalSql(String coluna) {
        String textoSemEspacos = "REPLACE(REPLACE(CONVERT(NVARCHAR(100), " + coluna + "), NCHAR(160), N''), N' ', N'')";
        return """
                COALESCE(
                    TRY_CONVERT(DECIMAL(19,4), %1$s),
                    TRY_CONVERT(DECIMAL(19,4), %2$s),
                    TRY_CONVERT(DECIMAL(19,4), REPLACE(REPLACE(%2$s, '.', ''), ',', '.'))
                )
                """.formatted(coluna, textoSemEspacos);
    }

    private static String textoSql(String coluna) {
        return "NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), " + coluna + "))), N'')";
    }

    private static String coalesceTextoSql(String fallback, String... colunas) {
        return "COALESCE(" + String.join(", ", Arrays.stream(colunas)
                .map(CotacoesDashboardSqlRepository::textoSql)
                .toList()) + ", " + fallback + ")";
    }

    private static String tipoOperacaoNormalizadoSql() {
        return """
                CASE
                    WHEN UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%PTL%%'
                      OR UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%FRAC / DED%%'
                      OR (
                            UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%FRAC%%'
                        AND UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%DED%%'
                      )
                      OR UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%PARCIAL%%'
                    THEN N'PTL'
                    WHEN UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%FTL%%'
                      OR UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%FECHAD%%'
                      OR UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%DEDICAD%%'
                    THEN N'FTL'
                    WHEN UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%LTL%%'
                      OR UPPER(COALESCE(CONVERT(NVARCHAR(255), [Tipo de operação]), N'') + N' ' + COALESCE(CONVERT(NVARCHAR(255), [Tabela]), N'')) LIKE N'%%FRACIONAD%%'
                    THEN N'LTL'
                    ELSE COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Tipo de operação]))), N''), N'Outros')
                END
                """;
    }

    private MapSqlParameterSource copiarParams(DashboardExportSqlBuilder.ExportSql source) {
        return new MapSqlParameterSource(source.params().getValues());
    }

    private String updatedAt(Timestamp timestamp) {
        LocalDateTime valor = timestamp != null ? timestamp.toLocalDateTime() : null;
        return TemporalJsonUtils.formatarIsoComOffset(valor);
    }

    private BigDecimal decimal(BigDecimal valor) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private Integer inteiroOuNulo(ResultSet rs, String coluna) throws SQLException {
        int valor = rs.getInt(coluna);
        return rs.wasNull() ? null : valor;
    }

    private Long longOuNulo(ResultSet rs, String coluna) throws SQLException {
        long valor = rs.getLong(coluna);
        return rs.wasNull() ? null : valor;
    }

    private String data(Date data) {
        return data != null ? data.toLocalDate().toString() : null;
    }

    private double percentual(BigDecimal valor) {
        return decimal(valor).doubleValue();
    }
}
