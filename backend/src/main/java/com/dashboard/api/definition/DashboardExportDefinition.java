package com.dashboard.api.definition;

import java.util.List;
import java.util.Map;

public enum DashboardExportDefinition {

    COLETAS(
            "coletas",
            "coletas",
            coletasProjection(),
            DateMode.NATIVE_LOCAL_DATE,
            "[Solicitacao]",
            List.of("[Filial]"),
            Map.of(
                    "filiais", List.of("[Filial]"),
                    "clientes", List.of("[Cliente]"),
                    "status", List.of("[Status]"),
                    "regioes", List.of("[Região Logística]"),
                    "usuarios", List.of("[Usuario]")
            ),
            List.of("[Solicitacao] DESC", "[Coleta] DESC"),
            new DedupConfig("[ID]", List.of("[Data de extracao] DESC", "[Solicitacao] DESC", "[Numero Manifesto] DESC"))
    ),
    FRETES(
            "fretes",
            "fretes",
            "dbo.fato_fretes_faturamento",
            DateMode.OFFSET_DATE_TIME,
            "data_referencia_faturamento",
            List.of("filial_nome"),
            Map.of(
                    "filiais", List.of("filial_nome"),
                    "status", List.of("status_frete"),
                    "pagadores", List.of("pagador_nome"),
                    "responsaveis", List.of("responsavel_regiao_destino_key"),
                    "ufOrigem", List.of("origem_uf"),
                    "ufDestino", List.of("destino_uf"),
                    "tiposFrete", List.of("tipo_frete"),
                    "modais", List.of("modal")
            ),
            List.of("data_referencia_faturamento DESC", "numero_minuta DESC", "frete_id DESC"),
            null,
            List.of("excluido_na_origem = 0 AND is_elegivel_faturamento = 1")
    ),
    TRACKING(
            "tracking",
            "tracking",
            trackingProjection(),
            DateMode.OFFSET_DATE_TIME,
            "[Data do frete]",
            List.of("[Filial Emissora]", "[Filial Origem]", "[Filial Atual]", "[Filial Destino]"),
            Map.of(
                    "filialEmissora", List.of("[Filial Emissora]"),
                    "filialAtual", List.of("[Filial Atual]"),
                    "filialDestino", List.of("[Filial Destino]"),
                    "regiaoOrigem", List.of("[Região Origem]"),
                    "regiaoDestino", List.of("[Região Destino]"),
                    "statusCarga", List.of("[Status Carga]"),
                    "classificacoes", List.of("[Classificação]"),
                    "siglaResponsavel", List.of("[Sigla Responsável Região Destino]"),
                    "numeroMinuta", List.of("[N° Minuta]")
            ),
            List.of("[Data do frete] DESC", "[N° Minuta] DESC"),
            null
    ),
    MANIFESTOS(
            "manifestos",
            "manifestos",
            "[vw_fato_manifestos_dash]",
            DateMode.OFFSET_DATE_TIME,
            "[Data criação]",
            List.of("[Filial]"),
            Map.of(
                    "filiais", List.of("[Filial]"),
                    "status", List.of("[Status]"),
                    "motoristas", List.of("[Motorista]"),
                    "veiculos", List.of("[Veículo/Placa]"),
                    "numeroManifesto", List.of("[Número]"),
                    "classificacoes", List.of("[Classificação]"),
                    "tiposCarga", List.of("[Tipo de carga]"),
                    "tiposContrato", List.of("[Tipo de contrato]")
            ),
            List.of("[Data criação] DESC", "[Número] DESC"),
            null
    ),
    COTACOES(
            "cotacoes",
            "cotacoes",
            "[vw_cotacoes_powerbi]",
            DateMode.OFFSET_DATE_TIME,
            "[Data Cotação]",
            List.of("[Filial]"),
            Map.of(
                    "filiais", List.of("[Filial]"),
                    "clientes", List.of("[Cliente Pagador]"),
                    "ufOrigem", List.of("[UF Origem]"),
                    "ufDestino", List.of("[UF Destino]"),
                    "statusConversao", List.of("[Status Conversão]"),
                    "tabelas", List.of("[Tabela]"),
                    "usuarios", List.of("[Usuario Key]"),
                    "classificacoes", List.of("[Tipo de operação]"),
                    "origens", List.of("[Origem]"),
                    "destinos", List.of("[Destino]")
            ),
            List.of("[Data Cotação] DESC", "[N° Cotação] DESC", "[Trecho]",
                    "HASHBYTES('SHA2_256', CONVERT(varbinary(max), [Metadata]))"),
            null
    ),
    CONTAS_A_PAGAR(
            "contas-a-pagar",
            "contas-a-pagar",
            "[vw_contas_a_pagar_powerbi]",
            DateMode.LOCAL_DATE,
            "[Emissão]",
            List.of("[Filial]"),
            Map.of(
                    "filiais", List.of("[Filial]"),
                    "fornecedores", List.of("[Fornecedor/Nome]"),
                    "classificacoes", List.of("[Conta Contábil/Classificação]"),
                    "centrosCusto", List.of("[Centro de custo/Nome]"),
                    "pago", List.of("[Pago]"),
                    "conciliado", List.of("[Conciliado]")
            ),
            List.of("[Emissão] DESC", "[Lançamento a Pagar/N°] DESC"),
            null
    ),
    FATURAS_POR_CLIENTE(
            "faturas-por-cliente",
            "faturas-por-cliente",
            "dbo.dashboard_financeiro_fretes",
            DateMode.NATIVE_LOCAL_DATE,
            "data_financeira",
            List.of("filial"),
            Map.of(
                    "filiais", List.of("filial"),
                    "pagadores", List.of("pagador_nome"),
                    "clientesCnpj", List.of("cliente_cnpj", "cliente_cnpj_key", "pagador_documento", "pagador_documento_key")
            ),
            List.of("data_financeira DESC", "unique_id DESC"),
            null,
            List.of("excluido_na_origem = 0")
    ),
    ETL_SAUDE(
            "etl-saude",
            "etl-saude",
            "[vw_bi_monitoramento]",
            DateMode.LOCAL_DATE,
            "[Data]",
            List.of(),
            Map.of("status", List.of("[Status]")),
            List.of("[Data] DESC", "[Inicio] DESC"),
            null
    );

    private final String dashboardId;
    private final String nomeArquivo;
    private final String viewName;
    private final DateMode dateMode;
    private final String dateColumn;
    private final List<String> escopoColumns;
    private final Map<String, List<String>> filtros;
    private final List<String> orderBy;
    private final DedupConfig dedupConfig;
    private final List<String> requiredPredicates;

    DashboardExportDefinition(
            String dashboardId,
            String nomeArquivo,
            String viewName,
            DateMode dateMode,
            String dateColumn,
            List<String> escopoColumns,
            Map<String, List<String>> filtros,
            List<String> orderBy,
            DedupConfig dedupConfig
    ) {
        this(dashboardId, nomeArquivo, viewName, dateMode, dateColumn, escopoColumns, filtros, orderBy, dedupConfig, List.of());
    }

    DashboardExportDefinition(
            String dashboardId,
            String nomeArquivo,
            String viewName,
            DateMode dateMode,
            String dateColumn,
            List<String> escopoColumns,
            Map<String, List<String>> filtros,
            List<String> orderBy,
            DedupConfig dedupConfig,
            List<String> requiredPredicates
    ) {
        this.dashboardId = dashboardId;
        this.nomeArquivo = nomeArquivo;
        this.viewName = viewName;
        this.dateMode = dateMode;
        this.dateColumn = dateColumn;
        this.escopoColumns = List.copyOf(escopoColumns);
        this.filtros = Map.copyOf(filtros);
        this.orderBy = List.copyOf(orderBy);
        this.dedupConfig = dedupConfig;
        this.requiredPredicates = List.copyOf(requiredPredicates);
    }

    String dashboardId() {
        return dashboardId;
    }

    public String nomeArquivo() {
        return nomeArquivo;
    }

    public String viewName() {
        return viewName;
    }

    public DateMode dateMode() {
        return dateMode;
    }

    public String dateColumn() {
        return dateColumn;
    }

    public List<String> escopoColumns() {
        return escopoColumns;
    }

    public Map<String, List<String>> filtros() {
        return filtros;
    }

    public List<String> orderBy() {
        return orderBy;
    }

    public DedupConfig dedupConfig() {
        return dedupConfig;
    }

    public List<String> requiredPredicates() {
        return requiredPredicates;
    }

    public boolean temFiltroStatusProcesso() {
        return this == FATURAS_POR_CLIENTE;
    }

    private static String coletasProjection() {
        return """
                (
                    SELECT
                        coletas_base.*,
                        CASE
                            WHEN coletas_base.[Solicitacao] IS NULL THEN NULL
                            WHEN LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), coletas_base.[Status])))) IN (N'finalizada', N'coletada', N'cancelada')
                             AND coletas_base.[Finalizacao] IS NOT NULL
                                THEN DATEDIFF(day, coletas_base.[Solicitacao], coletas_base.[Finalizacao])
                            ELSE DATEDIFF(day, coletas_base.[Solicitacao], CONVERT(date, GETDATE()))
                        END AS [Dias em Aberto]
                    FROM [vw_coletas_powerbi] coletas_base
                )
                """;
    }

    private static String trackingProjection() {
        return """
                (
                    SELECT
                        base_raw.[Hora (Solicitacao)],
                        base_raw.[N° Minuta],
                        base_raw.[Tipo],
                        base_raw.[Data do frete],
                        base_raw.[Volumes],
                        base_raw.[Peso Taxado],
                        base_raw.[Peso Taxado Decimal],
                        base_raw.[Valor NF],
                        base_raw.[Valor NF Decimal],
                        base_raw.[Valor Frete],
                        base_raw.[Tipo Serviço],
                        filial_emissora.valor AS [Filial Emissora],
                        base_raw.[Previsão Entrega/Previsão de entrega],
                        COALESCE(NULLIF(TRIM(base_raw.[Região Destino]), N''), N'Sem região') AS [Região Destino],
                        filial_destino.valor AS [Filial Destino],
                        responsavel_destino.valor AS [Responsável pela Região de Destino],
                        responsavel_destino.sigla AS [Sigla Responsável Região Destino],
                        base_raw.[Classificação],
                        status_painel.valor AS [Status Carga],
                        LOWER(status_painel.valor) AS [Status Normalizado],
                        CASE WHEN status_painel.valor = N'Finalizadas' THEN 1 ELSE 0 END AS [Status Terminal],
                        0 AS [Cancelado Flag],
                        filial_atual.valor AS [Filial Atual],
                        base_raw.[Região Origem],
                        filial_origem.valor AS [Filial Origem],
                        localizacao_atual.valor AS [Localização Atual],
                        base_raw.[Hash Localização],
                        base_raw.[Metadata],
                        base_raw.[Data de extracao]
                    FROM [vw_localizacao_cargas_powerbi] base_raw
                    CROSS APPLY (VALUES (LOWER(COALESCE(
                        NULLIF(TRIM(base_raw.[Status Normalizado]), N''),
                        NULLIF(TRIM(base_raw.[Status Carga]), N''),
                        N'sem_status'
                    )) COLLATE Latin1_General_CI_AI)) origem(status)
                    CROSS APPLY (VALUES (CASE
                        WHEN origem.status IN (N'pending', N'pendente', N'sem_status', N'sem status', N'in_warehouse',
                                               N'no galpão', N'no armazém', N'em armazém') THEN N'No Armazém'
                        WHEN origem.status IN (N'in_transfer', N'em transferência') THEN N'Em Transferência'
                        WHEN origem.status IN (N'manifested', N'manifestada', N'manifestado') THEN N'Manifestada'
                        WHEN origem.status IN (N'delivering', N'em entrega') THEN N'Em Entrega'
                        WHEN origem.status IN (N'finished', N'delivered', N'finalizado', N'finalizada', N'finalizadas',
                                               N'entregue') THEN N'Finalizadas'
                    END)) status_painel(valor)
                    %s
                    %s
                    %s
                    %s
                    %s
                    %s
                    WHERE status_painel.valor IS NOT NULL
                    /*__TRACKING_BASE_FILTERS__*/
                )
                """.formatted(
                responsavelRegiaoDestinoApply(),
                filialSiglaApply("filial_emissora", List.of("base_raw.[Filial Emissora]")),
                filialSiglaApply("filial_destino", List.of("base_raw.[Filial Destino]")),
                filialSiglaApply("filial_origem", List.of("base_raw.[Filial Origem]")),
                filialSiglaApply("filial_atual", List.of(
                        "base_raw.[Filial Atual]",
                        "base_raw.[Localização Atual]",
                        "base_raw.[Filial Emissora]"
                )),
                filialSiglaApply("localizacao_atual", List.of(
                        "base_raw.[Localização Atual]",
                        "base_raw.[Filial Atual]",
                        "base_raw.[Filial Emissora]"
                ))
        );
    }

    private static String responsavelRegiaoDestinoApply() {
        return """
                    CROSS APPLY (VALUES (NULLIF(TRIM(base_raw.[Responsável pela Região de Destino]), N''))) nome(fantasia)
                    CROSS APPLY (VALUES (CASE
                        WHEN nome.fantasia COLLATE Latin1_General_CI_AI IN (N'SEM_MAP', N'Sem responsável') THEN NULL
                        ELSE nome.fantasia
                    END)) responsavel(nome)
                    CROSS APPLY (VALUES (
                        COALESCE(responsavel.nome, N'Sem responsável'),
                        COALESCE(UPPER(LEFT(responsavel.nome, 3)), N'FEC')
                    )) responsavel_destino(valor, sigla)
                """;
    }

    private static String filialSiglaApply(String alias, List<String> colunasFallback) {
        List<String> expressoes = colunasFallback.stream()
                .map(coluna -> "NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), " + coluna + "))), N'')")
                .toList();
        String valorSql = expressoes.size() == 1
                ? expressoes.get(0)
                : "COALESCE(" + String.join(", ", expressoes) + ")";

        return """
                    OUTER APPLY (
                        SELECT COALESCE(
                            CASE
                                WHEN filial_valor.valor IS NULL THEN NULL
                                WHEN CHARINDEX(N'-', filial_valor.valor) = 0 THEN filial_valor.valor
                                WHEN UPPER(LTRIM(RTRIM(LEFT(filial_valor.valor, CHARINDEX(N'-', filial_valor.valor) - 1)))) = N'SEM_MAP'
                                THEN NULLIF(LTRIM(RTRIM(
                                    CASE
                                        WHEN CHARINDEX(N'-', filial_valor.valor, CHARINDEX(N'-', filial_valor.valor) + 1) > 0
                                        THEN SUBSTRING(
                                            filial_valor.valor,
                                            CHARINDEX(N'-', filial_valor.valor) + 1,
                                            CHARINDEX(N'-', filial_valor.valor, CHARINDEX(N'-', filial_valor.valor) + 1)
                                                - CHARINDEX(N'-', filial_valor.valor) - 1
                                        )
                                        ELSE SUBSTRING(
                                            filial_valor.valor,
                                            CHARINDEX(N'-', filial_valor.valor) + 1,
                                            LEN(filial_valor.valor)
                                        )
                                    END
                                )), N'')
                                ELSE NULLIF(LTRIM(RTRIM(LEFT(filial_valor.valor, CHARINDEX(N'-', filial_valor.valor) - 1))), N'')
                            END,
                            filial_valor.valor
                        ) AS valor
                        FROM (
                            SELECT %s AS valor
                        ) filial_valor
                    ) %s
                """.formatted(valorSql, alias);
    }

    public enum DateMode {
        LOCAL_DATE,
        NATIVE_LOCAL_DATE,
        OFFSET_DATE_TIME
    }

    public record DedupConfig(String partitionBy, List<String> orderBy) {
    }
}
