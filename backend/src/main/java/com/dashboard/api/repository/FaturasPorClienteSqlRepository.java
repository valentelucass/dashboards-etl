package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteAgingBucketDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteAgingEscopo;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteDrilldownNivel;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteDrilldownPointDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteGranularidade;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteMensalDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteMetrica;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteOverviewDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteReferenciaTemporal;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteSerieDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusEvolucaoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusProcessoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteTopClienteDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.faturascliente.ClienteEmAtrasoDTO;
import com.dashboard.api.dto.faturascliente.EvolucaoFretesRecebiveisDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class FaturasPorClienteSqlRepository {

    private static final List<String> ORDEM_AGING = List.of(
            "A vencer",
            "1-15 dias",
            "16-30 dias",
            "31-60 dias",
            "61+ dias",
            "Sem vencimento"
    );

    private final NamedParameterJdbcOperations jdbcTemplate;
    private final DashboardExportSqlBuilder sqlBuilder;
    private final EscopoFilialService escopoFilialService;

    public FaturasPorClienteSqlRepository(
            @ConsultaAnalitica NamedParameterJdbcOperations jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder,
            EscopoFilialService escopoFilialService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.sqlBuilder = sqlBuilder;
        this.escopoFilialService = escopoFilialService;
    }

    public FaturasPorClienteOverviewDTO buscarOverview(FiltroConsultaDTO filtro, LocalDate dataReferencia) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("dataReferencia", dataReferencia);

        String sql = baseNormalizadaSql(source) + """
                , por_documento AS (
                    SELECT cliente_chave, documento_fatura, MAX(snapshot_em) AS snapshot_em,
                           SUM(valor_faturado_rateado) AS valor_faturado, SUM(valor_a_faturar) AS valor_a_faturar,
                           COUNT(*) AS fretes, MAX(baixa_titulo) AS baixa, MAX(data_base_prazo) AS emissao,
                           MAX(data_vencimento_fatura) AS vencimento,
                           SUM(CASE WHEN documento_fatura IS NOT NULL THEN CAST(DATEDIFF(day, data_servico_frete, data_base_prazo) AS bigint) END) AS dias_ate_fatura,
                           COUNT(CASE WHEN documento_fatura IS NOT NULL AND data_servico_frete IS NOT NULL AND data_base_prazo IS NOT NULL THEN 1 END) AS fretes_com_datas
                    FROM base_normalizada
                    GROUP BY cliente_chave, documento_fatura
                )
                SELECT MAX(snapshot_em) AS updated_at, SUM(valor_faturado) AS valor_faturado,
                       SUM(valor_a_faturar) AS valor_a_faturar,
                       SUM(CASE WHEN documento_fatura IS NOT NULL THEN fretes ELSE 0 END) AS registros_faturados,
                       SUM(CASE WHEN documento_fatura IS NULL THEN fretes ELSE 0 END) AS aguardando_faturamento,
                       SUM(CASE WHEN documento_fatura IS NOT NULL AND baixa IS NULL THEN valor_faturado ELSE 0 END) AS carteira,
                       SUM(CASE WHEN baixa IS NULL AND vencimento < :dataReferencia THEN valor_faturado ELSE 0 END) AS vencido,
                       SUM(CASE WHEN documento_fatura IS NOT NULL AND baixa IS NULL AND vencimento < :dataReferencia THEN 1 ELSE 0 END) AS titulos_em_atraso,
                       AVG(CAST(DATEDIFF(day, emissao, vencimento) AS decimal(19,2))) AS prazo_medio_dias,
                       AVG(CAST(DATEDIFF(day, emissao, baixa) AS decimal(19,2))) AS prazo_recebimento_dias,
                       SUM(dias_ate_fatura) * 1.0 / NULLIF(SUM(fretes_com_datas), 0) AS prazo_ate_faturar,
                       COUNT(DISTINCT cliente_chave) AS clientes_ativos
                FROM por_documento
                OPTION (MAXDOP 1)
                """;

        return jdbcTemplate.queryForObject(sql, params, (rs, rowNum) -> {
            BigDecimal faturado = decimal(rs.getBigDecimal("valor_faturado"));
            BigDecimal aFaturar = decimal(rs.getBigDecimal("valor_a_faturar"));
            BigDecimal carteira = decimal(rs.getBigDecimal("carteira"));
            BigDecimal vencido = decimal(rs.getBigDecimal("vencido"));
            BigDecimal ateFaturar = rs.getBigDecimal("prazo_ate_faturar");
            BigDecimal prazoRecebimento = rs.getBigDecimal("prazo_recebimento_dias");
            return new FaturasPorClienteOverviewDTO(updatedAt(rs.getTimestamp("updated_at")), faturado,
                    rs.getInt("registros_faturados"), rs.getInt("aguardando_faturamento"),
                    rs.getInt("titulos_em_atraso"), umaCasa(rs.getBigDecimal("prazo_medio_dias")),
                    rs.getInt("clientes_ativos"), aFaturar, carteira, vencido,
                    percentual(faturado, faturado.add(aFaturar)), percentual(vencido, carteira),
                    prazoRecebimento == null ? null : umaCasa(prazoRecebimento), ateFaturar == null ? null : umaCasa(ateFaturar));
        });
    }

    private static BigDecimal percentual(BigDecimal parte, BigDecimal total) {
        return total.signum() == 0 ? BigDecimal.ZERO.setScale(2)
                : parte.movePointRight(2).divide(total, 2, RoundingMode.HALF_UP);
    }

    public List<FaturasPorClienteMensalDTO> buscarMensal(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String sql = baseNormalizadaSql(source) + """
                SELECT
                    CONVERT(CHAR(7), data_referencia_mensal, 23) AS mes,
                    CAST(COALESCE(SUM(valor_faturado_rateado), 0) AS DECIMAL(19,2)) AS valor_faturado,
                    COUNT(1) AS registros_faturados
                FROM base_normalizada
                WHERE documento_fatura IS NOT NULL
                  AND data_referencia_mensal IS NOT NULL
                GROUP BY CONVERT(CHAR(7), data_referencia_mensal, 23)
                ORDER BY mes
                """;

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new FaturasPorClienteMensalDTO(
                rs.getString("mes"),
                decimal(rs.getBigDecimal("valor_faturado")),
                rs.getInt("registros_faturados")
        ));
    }

    public List<FaturasPorClienteSerieDTO> buscarSerie(
            FiltroConsultaDTO filtro,
            FaturasPorClienteGranularidade granularidade,
            FaturasPorClienteReferenciaTemporal referencia,
            FaturasPorClienteMetrica metrica
    ) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro, referencia);
        source.params().addValue("dataReferencia", LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")));
        String dataReferencia = dataReferenciaSql(referencia);
        String periodo = periodoSql(granularidade, dataReferencia);
        String sql = baseNormalizadaSql(source) + """
                SELECT %s AS periodo,
                    CAST(COALESCE(%s, 0) AS DECIMAL(19,2)) AS valor,
                    COUNT(1) AS registros
                FROM base_normalizada
                WHERE status_processo = N'Faturado' AND %s IS NOT NULL
                GROUP BY %s
                ORDER BY periodo
                """.formatted(periodo, medidaSql(metrica), dataReferencia, periodo);
        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new FaturasPorClienteSerieDTO(
                rs.getString("periodo"), decimal(rs.getBigDecimal("valor")), rs.getInt("registros")
        ));
    }

    public List<FaturasPorClienteAgingBucketDTO> buscarAging(FiltroConsultaDTO filtro, LocalDate dataReferencia) {
        return buscarAging(filtro, dataReferencia, FaturasPorClienteAgingEscopo.TODOS);
    }

    public List<FaturasPorClienteAgingBucketDTO> buscarAging(
            FiltroConsultaDTO filtro,
            LocalDate dataReferencia,
            FaturasPorClienteAgingEscopo escopo
    ) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("dataReferencia", dataReferencia);
        String filtroEscopo = switch (escopo) {
            case TODOS -> "";
            case A_VENCER -> "WHERE faixa = N'A vencer'";
            case EM_ATRASO -> "WHERE faixa IN (N'1-15 dias', N'16-30 dias', N'31-60 dias', N'61+ dias')";
        };

        String sql = titulosAbertosSql(source) + """
                SELECT faixa, SUM(valor) AS valor, COUNT(*) AS titulos
                FROM classificados
                %s
                GROUP BY faixa
                OPTION (MAXDOP 1)
                """.formatted(filtroEscopo);

        Map<String, FaturasPorClienteAgingBucketDTO> porFaixa = new LinkedHashMap<>();
        jdbcTemplate.query(sql, params, (org.springframework.jdbc.core.RowCallbackHandler) rs -> porFaixa.put(
                rs.getString("faixa"),
                new FaturasPorClienteAgingBucketDTO(
                        rs.getString("faixa"),
                        decimal(rs.getBigDecimal("valor")),
                        rs.getInt("titulos")
                )
        ));

        return ORDEM_AGING.stream()
                .map(faixa -> porFaixa.getOrDefault(
                        faixa,
                        new FaturasPorClienteAgingBucketDTO(faixa, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP), 0)
                ))
                .toList();
    }

    public List<FaturasPorClienteDrilldownPointDTO> buscarDrilldownAging(
            FiltroConsultaDTO filtro,
            LocalDate dataReferencia,
            String faixa,
            FaturasPorClienteDrilldownNivel nivel,
            String cliente,
            int limite
    ) {
        if (faixa == null || faixa.isBlank() || (nivel == FaturasPorClienteDrilldownNivel.FATURA && (cliente == null || cliente.isBlank()))) {
            return List.of();
        }
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("dataReferencia", dataReferencia);
        params.addValue("agingFaixa", faixa);
        params.addValue("drillLimite", limite);
        boolean porFatura = nivel == FaturasPorClienteDrilldownNivel.FATURA;
        String filtroCliente = "";
        if (porFatura) {
            params.addValue("agingCliente", cliente);
            filtroCliente = "AND cliente_nome = :agingCliente";
        }
        String label = porFatura ? "documento_fatura" : "cliente_nome";
        String detalhe = porFatura ? "cliente_chave" : "NULL";
        String agrupamento = porFatura ? "documento_fatura, cliente_chave" : "cliente_nome";
        String sql = titulosAbertosSql(source) + """
                , agregado AS (
                    SELECT %s AS label, %s AS detalhe, SUM(valor) AS valor, COUNT(*) AS registros
                    FROM classificados WHERE faixa = :agingFaixa %s GROUP BY %s
                )
                """.formatted(label, detalhe, filtroCliente, agrupamento) + selecaoDrilldown();
        return mapearDrilldown(sql, params);
    }

    private String titulosAbertosSql(DashboardExportSqlBuilder.ExportSql source) {
        return baseNormalizadaSql(source) + """
                , titulos_abertos AS (
                    SELECT cliente_chave, documento_fatura,
                           COALESCE(MAX(cliente_nome), N'Sem cliente') AS cliente_nome, MAX(cliente_cnpj) AS cliente_cnpj,
                           SUM(valor_faturado_rateado) AS valor,
                           DATEDIFF(day, MAX(data_vencimento_fatura), :dataReferencia) AS dias_atraso
                    FROM base_normalizada
                    WHERE documento_fatura IS NOT NULL AND baixa_titulo IS NULL
                    GROUP BY cliente_chave, documento_fatura
                ), classificados AS (
                    SELECT *, CASE WHEN dias_atraso IS NULL THEN N'Sem vencimento'
                                   WHEN dias_atraso <= 0 THEN N'A vencer'
                                   WHEN dias_atraso <= 15 THEN N'1-15 dias'
                                   WHEN dias_atraso <= 30 THEN N'16-30 dias'
                                   WHEN dias_atraso <= 60 THEN N'31-60 dias'
                                   ELSE N'61+ dias' END AS faixa
                    FROM titulos_abertos
                )
                """;
    }

    private String selecaoDrilldown() {
        return """
                SELECT TOP (:drillLimite) label, detalhe, CAST(valor AS DECIMAL(19,2)) AS valor, registros,
                    CAST(COALESCE(SUM(valor) OVER (ORDER BY valor DESC, label, detalhe ROWS UNBOUNDED PRECEDING) * 100.0 / NULLIF(SUM(valor) OVER (), 0), 0) AS DECIMAL(19,2)) AS percentual_acumulado
                FROM agregado ORDER BY valor DESC, label, detalhe
                OPTION (MAXDOP 1)
                """;
    }

    public List<ClienteEmAtrasoDTO> buscarClientesEmAtraso(FiltroConsultaDTO filtro, LocalDate dataReferencia) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String sql = titulosAbertosSql(source) + """
                SELECT TOP (10) MAX(cliente_nome) AS cliente, MAX(cliente_cnpj) AS cliente_cnpj,
                       COUNT(*) AS titulos, MAX(dias_atraso) AS maior_atraso, SUM(valor) AS valor_em_atraso
                FROM classificados WHERE dias_atraso > 0 AND cliente_chave IS NOT NULL
                GROUP BY cliente_chave
                ORDER BY titulos DESC, valor_em_atraso DESC, maior_atraso DESC, cliente, cliente_chave
                OPTION (MAXDOP 1)
                """;
        return jdbcTemplate.query(sql, copiarParams(source).addValue("dataReferencia", dataReferencia),
                (rs, rowNum) -> new ClienteEmAtrasoDTO(rs.getString("cliente"), rs.getString("cliente_cnpj"),
                        rs.getInt("titulos"), rs.getInt("maior_atraso"), decimal(rs.getBigDecimal("valor_em_atraso"))));
    }

    public List<EvolucaoFretesRecebiveisDTO> buscarEvolucaoFretes(
            FiltroConsultaDTO filtro, FaturasPorClienteGranularidade granularidade,
            FaturasPorClienteReferenciaTemporal referencia) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro, referencia);
        String periodo = periodoSql(granularidade, dataReferenciaSql(referencia));
        String sql = baseNormalizadaSql(source) + """
                SELECT %s AS periodo, SUM(valor_frete) AS total, SUM(valor_faturado_rateado) AS faturado,
                       COUNT(*) AS fretes
                FROM base_normalizada GROUP BY %s ORDER BY periodo
                OPTION (MAXDOP 1)
                """.formatted(periodo, periodo);
        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new EvolucaoFretesRecebiveisDTO(
                rs.getString("periodo"), decimal(rs.getBigDecimal("total")), decimal(rs.getBigDecimal("faturado")),
                rs.getInt("fretes")));
    }

    public List<FaturasPorClienteTopClienteDTO> buscarTopClientes(FiltroConsultaDTO filtro, int limite) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String sql = baseNormalizadaSql(source) + """
                SELECT TOP (:limite) MAX(cliente_nome) AS cliente, MAX(cliente_cnpj) AS cliente_cnpj,
                       SUM(valor_faturado_rateado) AS valor_faturado, SUM(valor_a_faturar) AS valor_a_faturar
                FROM base_normalizada WHERE cliente_chave IS NOT NULL
                GROUP BY cliente_chave ORDER BY valor_faturado DESC, valor_a_faturar DESC, cliente, cliente_chave
                OPTION (MAXDOP 1)
                """;
        return jdbcTemplate.query(sql, copiarParams(source).addValue("limite", limite),
                (rs, rowNum) -> new FaturasPorClienteTopClienteDTO(rs.getString("cliente"), rs.getString("cliente_cnpj"),
                        decimal(rs.getBigDecimal("valor_faturado")), decimal(rs.getBigDecimal("valor_a_faturar"))));
    }

    public List<FaturasPorClienteDrilldownPointDTO> buscarDrilldownClientes(
            FiltroConsultaDTO filtro,
            LocalDate dataReferencia,
            int limite,
            FaturasPorClienteMetrica metrica,
            FaturasPorClienteDrilldownNivel nivel,
            String cliente,
            String cnpj
    ) {
        if ((nivel == FaturasPorClienteDrilldownNivel.CNPJ && (cliente == null || cliente.isBlank()))
                || (nivel == FaturasPorClienteDrilldownNivel.FATURA && (cnpj == null || cnpj.isBlank()))) {
            return List.of();
        }
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        MapSqlParameterSource params = copiarParams(source);
        params.addValue("dataReferencia", dataReferencia);
        params.addValue("drillLimite", limite);
        String clienteSql = "COALESCE(NULLIF(LTRIM(RTRIM(cliente_nome)), N''), N'Sem cliente')";
        String cnpjSql = "COALESCE(NULLIF(LTRIM(RTRIM(cliente_cnpj)), N''), N'Sem CNPJ')";
        String faturaSql = "COALESCE(NULLIF(LTRIM(RTRIM(documento_fatura)), N''), unique_id, N'Sem documento')";
        String labelSql = switch (nivel) {
            case CLIENTE -> clienteSql;
            case CNPJ -> cnpjSql;
            case FATURA -> faturaSql;
        };
        String detalheSql = switch (nivel) {
            case CLIENTE -> "NULL";
            case CNPJ -> clienteSql;
            case FATURA -> cnpjSql;
        };
        String agrupamentoSql = nivel == FaturasPorClienteDrilldownNivel.CLIENTE
                ? labelSql
                : labelSql + ", " + detalheSql;
        String filtros = "";
        if (nivel == FaturasPorClienteDrilldownNivel.CNPJ) {
            params.addValue("drillCliente", cliente);
            filtros = "AND " + clienteSql + " = :drillCliente";
        }
        if (nivel == FaturasPorClienteDrilldownNivel.FATURA) {
            params.addValue("drillCnpj", cnpj);
            filtros = "AND " + cnpjSql + " = :drillCnpj";
            if ("Sem CNPJ".equals(cnpj) && cliente != null && !cliente.isBlank()) {
                params.addValue("drillCliente", cliente);
                filtros += " AND " + clienteSql + " = :drillCliente";
            }
        }
        String sql = baseNormalizadaSql(source) + """
                , agregado AS (
                    SELECT %s AS label, %s AS detalhe, CAST(%s AS DECIMAL(19,2)) AS valor, COUNT(1) AS registros
                    FROM base_normalizada
                    WHERE status_processo = N'Faturado' %s
                    GROUP BY %s
                )
                SELECT TOP (:drillLimite) label, detalhe, valor, registros,
                    CAST(COALESCE(SUM(valor) OVER (ORDER BY valor DESC, label ROWS UNBOUNDED PRECEDING) * 100.0 / NULLIF(SUM(valor) OVER (), 0), 0) AS DECIMAL(19,2)) AS percentual_acumulado
                FROM agregado
                ORDER BY valor DESC, label
                """.formatted(labelSql, detalheSql, medidaSql(metrica), filtros, agrupamentoSql);
        return mapearDrilldown(sql, params);
    }

    public List<FaturasPorClienteStatusProcessoDTO> buscarStatusProcesso(FiltroConsultaDTO filtro) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String sql = baseNormalizadaSql(source) + """
                SELECT
                    status_processo,
                    COUNT(1) AS total
                FROM base_normalizada
                GROUP BY status_processo
                ORDER BY total DESC, status_processo
                """;

        return jdbcTemplate.query(sql, copiarParams(source), (rs, rowNum) -> new FaturasPorClienteStatusProcessoDTO(
                rs.getString("status_processo"),
                rs.getInt("total")
        ));
    }

    public List<FaturasPorClienteStatusEvolucaoDTO> buscarEvolucaoStatus(
            FiltroConsultaDTO filtro,
            FaturasPorClienteGranularidade granularidade
    ) {
        DashboardExportSqlBuilder.ExportSql source = source(filtro);
        String periodo = periodoSql(granularidade, "data_financeira");
        String sql = baseNormalizadaSql(source) + """
                SELECT %s AS periodo,
                    CASE WHEN status_processo = N'Faturado' THEN 1
                         WHEN status_processo = N'Aguardando Faturamento' THEN 2 ELSE 0 END AS situacao
                FROM base_normalizada
                OPTION (MAXDOP 1)
                """.formatted(periodo);
        // O agrupamento no SQL disputa memória com os relatórios. O leitor conserva apenas dois totais por período.
        return jdbcTemplate.query(sql, copiarParams(source), rs -> {
            var totais = new TreeMap<String, ContagemStatus>();
            while (rs.next()) {
                var contagem = totais.computeIfAbsent(rs.getString("periodo"), key -> new ContagemStatus());
                switch (rs.getInt("situacao")) {
                    case 1 -> contagem.faturado++;
                    case 2 -> contagem.aguardando++;
                    default -> { }
                }
            }
            return totais.entrySet().stream().map(entry -> new FaturasPorClienteStatusEvolucaoDTO(
                    entry.getKey(), entry.getValue().faturado, entry.getValue().aguardando)).toList();
        });
    }

    private static final class ContagemStatus {
        private int faturado;
        private int aguardando;
    }

    private String baseNormalizadaSql(DashboardExportSqlBuilder.ExportSql source) {
        return """
                WITH base_normalizada AS (
                    SELECT
                        unique_id,
                        chave_normalizacao,
                        documento_fatura,
                        data_emissao_cte,
                        data_emissao_fatura,
                        data_vencimento_fatura,
                        data_baixa_fatura,
                        data_base_prazo,
                        data_referencia_mensal,
                        data_financeira,
                        data_servico_frete,
                        valor_frete,
                        baixa_titulo,
                        valor_faturado_rateado,
                        valor_a_faturar,
                        cliente_chave,
                        cliente_nome,
                        cliente_cnpj,
                        status_processo,
                        status_pagamento,
                        snapshot_em
                    %s
                )
                """.formatted(
                source.sql()
        );
    }

    private DashboardExportSqlBuilder.ExportSql source(FiltroConsultaDTO filtro) {
        return sqlBuilder.buildFilteredSource(
                DashboardExportDefinition.FATURAS_POR_CLIENTE,
                filtro,
                escopoFilialService.escopoAtual(),
                Set.of()
        );
    }

    private DashboardExportSqlBuilder.ExportSql source(FiltroConsultaDTO filtro, FaturasPorClienteReferenciaTemporal referencia) {
        return sqlBuilder.buildFilteredSourceWithDateColumn(DashboardExportDefinition.FATURAS_POR_CLIENTE, filtro,
                escopoFilialService.escopoAtual(), Set.of(), dataReferenciaSql(referencia));
    }

    private String dataReferenciaSql(FaturasPorClienteReferenciaTemporal referencia) {
        return switch (referencia) {
            case EMISSAO -> "data_financeira";
            case VENCIMENTO -> "data_vencimento_fatura";
            case BAIXA -> "baixa_titulo";
        };
    }

    private String periodoSql(FaturasPorClienteGranularidade granularidade, String coluna) {
        return switch (granularidade) {
            case DIA -> "CONVERT(CHAR(10), " + coluna + ", 23)";
            case SEMANA -> "CONVERT(CHAR(10), DATEADD(day, -DATEDIFF(day, 0, " + coluna + ") % 7, " + coluna + "), 23)";
            case ANO -> "CONVERT(CHAR(4), YEAR(" + coluna + "))";
            case MES -> "CONVERT(CHAR(7), " + coluna + ", 23)";
        };
    }

    private String medidaSql(FaturasPorClienteMetrica metrica) {
        return switch (metrica) {
            case VALOR_FATURADO -> "SUM(valor_faturado_rateado)";
            case REGISTROS_FATURADOS -> "COUNT(1)";
            case TICKET_MEDIO -> "SUM(valor_faturado_rateado) / NULLIF(COUNT(1), 0)";
            case VALOR_EM_ATRASO -> "SUM(CASE WHEN data_vencimento_fatura < :dataReferencia AND baixa_titulo IS NULL THEN valor_faturado_rateado ELSE 0 END)";
        };
    }

    private List<FaturasPorClienteDrilldownPointDTO> mapearDrilldown(String sql, MapSqlParameterSource params) {
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> new FaturasPorClienteDrilldownPointDTO(
                rs.getString("label"),
                rs.getString("detalhe"),
                decimal(rs.getBigDecimal("valor")),
                rs.getInt("registros"),
                rs.getDouble("percentual_acumulado")
        ));
    }

    private MapSqlParameterSource copiarParams(DashboardExportSqlBuilder.ExportSql source) {
        return new MapSqlParameterSource(source.params().getValues());
    }

    private String updatedAt(Timestamp timestamp) {
        LocalDateTime valor = timestamp != null ? timestamp.toLocalDateTime() : null;
        return TemporalJsonUtils.formatarUtcComoIsoComOffset(valor);
    }

    private BigDecimal decimal(BigDecimal valor) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private double umaCasa(BigDecimal valor) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}
