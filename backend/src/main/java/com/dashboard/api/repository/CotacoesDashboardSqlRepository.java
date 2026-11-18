package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
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
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
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
            @ConsultaAnalitica NamedParameterJdbcOperations jdbcTemplate,
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

        String sql = baseMetricasSql(source) + """
                , grupos AS (
                    SELECT CASE WHEN GROUPING(status_exibicao) = 0 THEN 0
                                WHEN GROUPING(trecho) = 0 THEN 1
                                WHEN GROUPING(motivo_perda) = 0 THEN 2
                                WHEN GROUPING(cliente_pagador) = 0 THEN 3
                                WHEN GROUPING(uf_origem) = 0 THEN 4
                                WHEN GROUPING(uf_destino) = 0 THEN 5
                                ELSE 6 END AS grupo,
                           status_exibicao, trecho, motivo_perda, cliente_pagador,
                           uf_origem, uf_destino, tipo_operacao_normalizado,
                           -- O mesmo motivo pode chegar com grafias que só diferem em maiúsculas.
                           CASE WHEN GROUPING(motivo_perda) = 0
                                THEN MIN(motivo_perda COLLATE Latin1_General_100_BIN2) END AS motivo_exibicao,
                           COUNT(1) AS total,
                           SUM(valor_frete) AS valor,
                           SUM(CASE WHEN %1$s THEN valor_frete ELSE 0 END) AS valor_convertido,
                           SUM(CASE WHEN %1$s THEN 1 ELSE 0 END) AS convertidas,
                           SUM(CASE WHEN %2$s THEN 1 ELSE 0 END) AS reprovadas
                    FROM base_metricas
                    GROUP BY GROUPING SETS (
                        (status_exibicao), (trecho), (motivo_perda), (cliente_pagador),
                        (uf_origem), (uf_destino), (tipo_operacao_normalizado)
                    )
                ), series AS (
                    SELECT mapa.grafico, mapa.ordenar_por_total, g.motivo_exibicao,
                           g.status_exibicao, g.trecho, g.motivo_perda, g.cliente_pagador,
                           g.uf_origem, g.uf_destino, g.tipo_operacao_normalizado,
                           CASE WHEN mapa.perdas = 1 THEN g.reprovadas ELSE g.total END AS total,
                           CAST(CASE WHEN mapa.perdas = 1 THEN 0 ELSE g.valor END AS decimal(19,2)) AS valor,
                           CAST(CASE WHEN mapa.agrupado = 1 THEN g.valor_convertido ELSE 0 END AS decimal(19,2)) AS valor_convertido,
                           g.convertidas, g.reprovadas
                    FROM grupos g
                    JOIN (VALUES
                        ('FUNIL', 0, 0, 0, 1),
                        ('CORREDORES', 1, 0, 0, 0),
                        ('MOTIVOS_PERDA', 2, 1, 0, 1),
                        ('TRECHOS', 1, 0, 1, 0),
                        ('UF_ORIGEM', 4, 0, 1, 0),
                        ('UF_DESTINO', 5, 0, 1, 0),
                        ('TIPOS_OPERACAO', 6, 0, 1, 0),
                        ('PERDAS_CLIENTE', 3, 1, 0, 1),
                        ('PERDAS_TRECHO', 1, 1, 0, 1)
                    ) mapa(grafico, grupo, perdas, agrupado, ordenar_por_total) ON mapa.grupo = g.grupo
                    WHERE mapa.perdas = 0 OR g.reprovadas > 0
                ), ordenado AS (
                    SELECT *, ROW_NUMBER() OVER (
                        PARTITION BY grafico
                        ORDER BY CASE WHEN ordenar_por_total = 1 THEN CAST(total AS decimal(19,2)) ELSE valor END DESC,
                                 status_exibicao, trecho, motivo_perda, cliente_pagador,
                                 uf_origem, uf_destino, tipo_operacao_normalizado
                    ) AS ordem
                    FROM series
                )
                SELECT grafico, total, valor, valor_convertido, convertidas, reprovadas,
                       COALESCE(status_exibicao COLLATE DATABASE_DEFAULT, trecho COLLATE DATABASE_DEFAULT,
                                motivo_exibicao COLLATE DATABASE_DEFAULT, cliente_pagador COLLATE DATABASE_DEFAULT,
                                uf_origem COLLATE DATABASE_DEFAULT, uf_destino COLLATE DATABASE_DEFAULT,
                                tipo_operacao_normalizado COLLATE DATABASE_DEFAULT) AS nome
                FROM ordenado
                WHERE grafico = 'FUNIL' OR ordem <= 10
                ORDER BY grafico, ordem
                OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 0.02, OPTIMIZE FOR (@linhasGraficos = 64))
                END
                """.formatted(STATUS_CONVERTIDA_SQL, STATUS_REPROVADA_SQL);

        Map<Grafico, List<MedidaGrafico>> graficos = jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new MedidaGrafico(
                Grafico.valueOf(rs.getString("grafico")),
                rs.getString("nome"),
                rs.getInt("total"),
                decimal(rs.getBigDecimal("valor")),
                decimal(rs.getBigDecimal("valor_convertido")),
                rs.getInt("convertidas"),
                rs.getInt("reprovadas")
        )).stream().collect(Collectors.groupingBy(MedidaGrafico::grafico));

        return new CotacoesChartsDTO(
                mapearGrafico(graficos, Grafico.FUNIL, linha -> new CotacoesFunilDTO(linha.nome(), linha.total(), linha.valor())),
                mapearGrafico(graficos, Grafico.CORREDORES, linha -> new CotacoesCorredorValiosoDTO(linha.nome(), linha.valor(), linha.total())),
                mapearGrafico(graficos, Grafico.MOTIVOS_PERDA, MedidaGrafico::perda),
                mapearGrafico(graficos, Grafico.TRECHOS, MedidaGrafico::agrupamento),
                mapearGrafico(graficos, Grafico.UF_ORIGEM, MedidaGrafico::agrupamento),
                mapearGrafico(graficos, Grafico.UF_DESTINO, MedidaGrafico::agrupamento),
                mapearGrafico(graficos, Grafico.TIPOS_OPERACAO, MedidaGrafico::agrupamento),
                mapearGrafico(graficos, Grafico.PERDAS_CLIENTE, MedidaGrafico::perda),
                mapearGrafico(graficos, Grafico.PERDAS_TRECHO, MedidaGrafico::perda)
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

    private static <T> List<T> mapearGrafico(
            Map<Grafico, List<MedidaGrafico>> graficos,
            Grafico grafico,
            Function<MedidaGrafico, T> mapper
    ) {
        return graficos.getOrDefault(grafico, List.of()).stream().map(mapper).toList();
    }

    private enum Grafico {
        FUNIL, CORREDORES, MOTIVOS_PERDA, TRECHOS, UF_ORIGEM, UF_DESTINO, TIPOS_OPERACAO, PERDAS_CLIENTE, PERDAS_TRECHO
    }

    private record MedidaGrafico(
            Grafico grafico,
            String nome,
            int total,
            BigDecimal valor,
            BigDecimal valorConvertido,
            int convertidas,
            int reprovadas
    ) {
        CotacoesMotivoPerdaDTO perda() {
            return new CotacoesMotivoPerdaDTO(nome, total);
        }

        CotacoesAgrupamentoDTO agrupamento() {
            return new CotacoesAgrupamentoDTO(nome, valor, valorConvertido, total, convertidas, reprovadas);
        }
    }

    private String baseMetricasSql(DashboardExportSqlBuilder.ExportSql source) {
        // O limite efetivo é o máximo de BIGINT. A estimativa no OPTIMIZE FOR reduz a
        // reserva inicial de memória para que os gráficos possam concorrer com as tabelas.
        return """
                IF NOT EXISTS (SELECT 1 %1$s)
                    SELECT CAST(NULL AS varchar(20)) AS grafico, CAST(NULL AS int) AS total,
                           CAST(NULL AS decimal(19,2)) AS valor, CAST(NULL AS decimal(19,2)) AS valor_convertido,
                           CAST(NULL AS int) AS convertidas, CAST(NULL AS int) AS reprovadas,
                           CAST(NULL AS nvarchar(255)) AS nome WHERE 1 = 0;
                ELSE
                BEGIN
                DECLARE @linhasGraficos bigint = 9223372036854775807;
                WITH base_filtrada AS (
                    SELECT TOP (@linhasGraficos) *
                    %1$s
                ),
                base_metricas AS (
                    SELECT
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Status Conversão]))), N''), N'Sem status') AS status_exibicao,
                        %2$s AS status_normalizado,
                        %3$s AS valor_frete,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Trecho]))), N''), N'Sem trecho') AS trecho,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Motivo Perda]))), N''), N'Sem motivo') AS motivo_perda,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente Pagador]))), N''), N'Sem cliente') AS cliente_pagador,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), [UF Origem]))), N''), N'Sem UF origem') AS uf_origem,
                        COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), [UF Destino]))), N''), N'Sem UF destino') AS uf_destino,
                        %4$s AS tipo_operacao_normalizado
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
