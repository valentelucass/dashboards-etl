package com.dashboard.api.service;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class DashboardExportSqlBuilderTest {

    private final DashboardExportSqlBuilder builder = new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao());

    @Test
    void buildSelectDeveAplicarDatasOffsetFiltrosEscopoSemLimite() {
        FiltroConsultaDTO filtro = filtro(Map.of(
                "status", List.of("Entregue"),
                "pagadores", List.of("ACME")
        ));

        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro,
                new EscopoFilialService.EscopoFilial(false, List.of("SP")),
                Set.of()
        );

        assertThat(query.sql()).contains("data_referencia_faturamento >= :inicioOffset AND data_referencia_faturamento < :fimOffset");
        assertThat(query.sql()).contains("excluido_na_origem = 0 AND is_elegivel_faturamento = 1");
        assertThat(query.sql()).contains("ORDER BY data_referencia_faturamento DESC");
        assertThat(query.sql()).contains("filial_nome IN (:escopoFiliais)");
        assertThat(query.sql()).contains("status_frete IN (:filtro_status)");
        assertThat(query.sql()).contains("pagador_nome IN (:filtro_pagadores)");
        assertThat(query.sql()).contains("dbo.fato_fretes_faturamento");
        assertThat(query.sql()).doesNotContain("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX)");
        assertThat(query.sql()).doesNotContainIgnoringCase("limit");
        assertThat(query.sql()).doesNotContainIgnoringCase("top ");
        assertThat(query.params().getValues()).containsKeys("inicioOffset", "fimOffset", "escopoFiliais", "filtro_status", "filtro_pagadores");
    }

    @Test
    void buildCountDeveAplicarDatasLocalDateComJanelaExclusiva() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildCount(
                DashboardExportDefinition.CONTAS_A_PAGAR,
                filtro(Map.of("pago", List.of("Sim"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("[Emissão] >= :dataInicio AND [Emissão] < :dataFimExclusivo");
        assertThat(query.params().getValues()).containsEntry("dataInicio", LocalDate.of(2026, 3, 17));
        assertThat(query.params().getValues()).containsEntry("dataFimExclusivo", LocalDate.of(2026, 4, 17));
    }

    @Test
    void buildSelectDeveAplicarDeduplicacaoEmViewsConfiguradas() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.COLETAS,
                filtro(Map.of()),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("ROW_NUMBER() OVER (PARTITION BY [ID]");
        assertThat(query.sql()).contains("WHERE [__rn] = 1");
        assertThat(query.sql()).endsWith("OPTION (MAXDOP 1, RECOMPILE)");
        assertThat(query.sql()).doesNotContain("N'excluída'");
    }

    @Test
    void buildSelectColetasDeveUsarSolicitacaoComoDataNativa() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.COLETAS,
                filtro(Map.of()),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("[Solicitacao] >= :dataInicio AND [Solicitacao] < :dataFimExclusivo");
        assertThat(query.sql()).doesNotContain("TRY_CONVERT(date, [Solicitacao])");
        assertThat(query.params().getValues()).containsEntry("dataInicio", LocalDate.of(2026, 3, 17));
        assertThat(query.params().getValues()).containsEntry("dataFimExclusivo", LocalDate.of(2026, 4, 17));
    }

    @Test
    void buildDistinctDeveIgnorarProprioFiltroDeStatusFretes() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildDistinct(
                DashboardExportDefinition.FRETES,
                "status_frete",
                filtro(Map.of("status", List.of("Entregue"), "pagadores", List.of("ACME"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of("status")
        );

        assertThat(query.sql()).doesNotContain(":filtro_status");
        assertThat(query.sql()).contains(":filtro_pagadores");
    }

    @Test
    void buildSelectDeveMapearStatusProcessoMaterializado() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FATURAS_POR_CLIENTE,
                filtro(Map.of("statusProcesso", List.of("Faturado"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("dbo.fato_gestao_vista_faturas");
        assertThat(query.sql()).contains("excluido_na_origem = 0");
        assertThat(query.sql()).contains("status_processo IN (N'Faturado')");
    }

    @Test
    void buildSelectDeveFiltrarFaturasPorClientePorCnpj() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FATURAS_POR_CLIENTE,
                filtro(Map.of("clientesCnpj", List.of("12.345.678/0001-90"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("cliente_cnpj IN (:filtro_clientesCnpj)");
        assertThat(query.sql()).contains("cliente_cnpj_key IN (:filtro_clientesCnpj)");
        assertThat(query.sql()).contains("pagador_documento IN (:filtro_clientesCnpj)");
        assertThat(query.sql()).contains("pagador_documento_key IN (:filtro_clientesCnpj)");
        assertThat(query.sql()).doesNotContain("PARTITION BY");
        assertThat(query.params().getValues()).containsKey("filtro_clientesCnpj");
    }

    @Test
    void buildSelectCotacoesDeveFiltrarUsuarioPorChavePublicada() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.COTACOES,
                filtro(Map.of("usuarios", List.of("Maria Silva"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("[Usuario Key] IN (:filtro_usuarios)");
        assertThat(query.sql()).doesNotContain("[Solicitante] IN (:filtro_usuarios)");
        assertThat(query.sql()).doesNotContain("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX)");
        assertThat(query.sql()).doesNotContain("LIKE :filtro_usuarios");
        assertThat(query.params().getValues()).containsEntry("filtro_usuarios", List.of("maria silva"));
    }

    @Test
    void buildSelectDeveAplicarCodigoTabelaComIgualdadeNumerica() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaCodigo", List.of("12345"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("TRY_CONVERT(BIGINT, frete_id) = :filtro_tabelaCodigoNumero");
        assertThat(query.sql()).contains("TRY_CONVERT(BIGINT, numero_minuta) = :filtro_tabelaCodigoNumero");
        assertThat(query.sql()).doesNotContain(":filtro_tabelaCodigoPrefixo");
        assertThat(query.params().getValues()).containsEntry("filtro_tabelaCodigoNumero", 12345L);
    }

    @Test
    void buildSelectNaoDeveGerarLikeAmploParaTextoCurtoTabela() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaRazaoSocial", List.of("ab"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).doesNotContain("filtro_tabelaRazaoSocial");
    }

    @Test
    void buildSelectDeveMapearTabelaStatusProcessoMaterializado() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FATURAS_POR_CLIENTE,
                filtro(Map.of("tabelaStatus", List.of("Faturado"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("status_processo IN (N'Faturado')");
    }

    @Test
    void buildSelectDeveAplicarFiltroPorColunaCodigoComIgualdadeNumerica() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.id", List.of("12345"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("TRY_CONVERT(BIGINT, frete_id) = :filtro_tabelaColuna_id");
        assertThat(query.params().getValues()).containsEntry("filtro_tabelaColuna_id", 12345L);
    }

    @Test
    void buildSelectDeveFiltrarMinutaDeFaturamentoComIgualdadeDireta() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.numeroMinuta", List.of("381633"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("numero_minuta = :filtro_tabelaColuna_numeroMinuta");
        assertThat(query.sql()).doesNotContain("TRY_CONVERT(BIGINT, numero_minuta)");
        assertThat(query.sql()).doesNotContain("[N° Minuta] = :filtro_tabelaColuna_numeroMinuta");
        assertThat(query.params().getValues()).containsEntry("filtro_tabelaColuna_numeroMinuta", 381633L);
    }

    @Test
    void buildSelectNaoDeveGerarLikeAmploParaTextoCurtoPorColuna() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.pagador", List.of("ab"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).doesNotContain("filtro_tabelaColuna_pagador");
    }

    @Test
    void buildSelectDeveAplicarFiltroPorColunaNumeroComDecimalSeguro() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.valorFrete", List.of("123,45"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("TRY_CONVERT(DECIMAL(19,4), valor_frete) = :filtro_tabelaColuna_valorFrete");
        assertThat(query.params().getValues()).containsEntry("filtro_tabelaColuna_valorFrete", new BigDecimal("123.45"));
    }

    @Test
    void buildSelectDeveAplicarFiltroPorColunaStatusComIn() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.status", List.of("Entregue", "Pendente"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("status_frete IN (:filtro_tabelaColuna_status)");
        assertThat(query.sql()).doesNotContain("LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX)");
        assertThat(query.params().getValues()).containsEntry("filtro_tabelaColuna_status", List.of("entregue", "pendente"));
    }

    @Test
    void buildSelectDeveAplicarFiltroPorColunaDataComJanelaExclusiva() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.previsaoEntrega", List.of("2026-05"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql())
                .contains("data_referencia_faturamento >= :filtro_tabelaColuna_previsaoEntrega_inicio")
                .contains("data_referencia_faturamento < :filtro_tabelaColuna_previsaoEntrega_fim")
                .doesNotContain("CONVERT(VARCHAR(10)")
                .doesNotContain("TRY_CONVERT(date, CONVERT(NVARCHAR(64), [Previsão de Entrega]))");
        assertThat(query.params().getValues())
                .containsEntry("filtro_tabelaColuna_previsaoEntrega_inicio", LocalDate.of(2026, 5, 1))
                .containsEntry("filtro_tabelaColuna_previsaoEntrega_fim", LocalDate.of(2026, 6, 1));
    }

    @Test
    void buildSelectDeveAplicarFiltroEspecialDocumentoTipoFretes() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.FRETES,
                filtro(Map.of("tabelaColuna.documentoTipo", List.of("CT-e"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("CASE WHEN cte_id IS NOT NULL THEN 'ct-e'");
        assertThat(query.sql()).contains(":filtro_tabelaColuna_documentoTipo");
    }

    @Test
    void buildSelectTrackingDeveFiltrarPesoComConversaoDecimalSegura() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.TRACKING,
                filtro(Map.of("tabelaColuna.pesoTaxadoRaw", List.of("123,45"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("TRY_CONVERT(DECIMAL(19,4), [Peso Taxado])");
        assertThat(query.sql()).contains("TRY_CONVERT(DECIMAL(19,4), REPLACE(REPLACE(CONVERT(NVARCHAR(50), [Peso Taxado]), '.', ''), ',', '.'))");
        assertThat(query.sql()).contains(":filtro_tabelaColuna_pesoTaxadoRaw");
        assertThat(query.params().getValues()).containsEntry("filtro_tabelaColuna_pesoTaxadoRaw", new BigDecimal("123.45"));
    }

    @Test
    void buildSelectTrackingDeveFiltrarFilialAtualPorTextoECodigoOperacional() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.TRACKING,
                filtro(Map.of("filialAtual", List.of("SPO - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("[Filial Atual] IN (:filtro_filialAtual)");
        assertThat(query.sql()).contains("[Filial Atual] IN (:filtro_filialAtualCodigos)");
        assertThat(query.sql()).contains("base_raw.[Filial Atual] IN (:filtro_filialAtual)");
        assertThat(query.sql()).contains("base_raw.[Filial Atual] IN (:filtro_filialAtualCodigos)");
        assertThat(query.params().getValues()).containsEntry("filtro_filialAtual", List.of("spo - rodogarcia transportes rodoviarios ltda"));
        assertThat(query.params().getValues()).containsEntry("filtro_filialAtualCodigos", List.of("spo"));
    }

    @Test
    void buildSelectManifestosDeveFiltrarFilialPorTextoECodigoOperacional() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.MANIFESTOS,
                filtro(Map.of("filiais", List.of("AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql()).contains("[Filial] IN (:filtro_filiais)");
        assertThat(query.sql()).contains("IN (:filtro_filiaisCodigos)");
        assertThat(query.sql()).contains("CHARINDEX(N'-'");
        assertThat(query.params().getValues()).containsEntry("filtro_filiais", List.of("agu - rodogarcia transportes rodoviarios ltda"));
        assertThat(query.params().getValues()).containsEntry("filtro_filiaisCodigos", List.of("agu"));
    }

    @Test
    void buildSelectTrackingDeveAplicarEscopoDeFiliaisPorTextoECodigoOperacional() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.TRACKING,
                filtro(Map.of()),
                new EscopoFilialService.EscopoFilial(false, List.of("CWB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA")),
                Set.of()
        );

        assertThat(query.sql()).contains("[Filial Atual] IN (:escopoFiliais)");
        assertThat(query.sql()).contains("[Filial Atual] IN (:escopoFiliaisCodigos)");
        assertThat(query.sql()).contains("base_raw.[Filial Atual] IN (:escopoFiliais)");
        assertThat(query.sql()).contains("base_raw.[Filial Atual] IN (:escopoFiliaisCodigos)");
        assertThat(query.params().getValues()).containsEntry("escopoFiliais", List.of("cwb - rodogarcia transportes rodoviarios ltda"));
        assertThat(query.params().getValues()).containsEntry("escopoFiliaisCodigos", List.of("cwb"));
    }

    @Test
    void buildSelectTrackingDeveUsarProjecaoNormalizadaDeStatusELocalizacao() {
        DashboardExportSqlBuilder.ExportSql query = builder.buildSelect(
                DashboardExportDefinition.TRACKING,
                filtro(Map.of("filialAtual", List.of("SEM_MAP - PPB - EHL TRANSPORTES"))),
                EscopoFilialService.EscopoFilial.comAcessoTotal(),
                Set.of()
        );

        assertThat(query.sql())
                .contains("N'NO ARMAZÉM'")
                .contains("status_calc.status_norm IN (N'pending', N'pendente', N'sem_status', N'sem status')")
                .contains("base_raw.[Status Normalizado] IS NULL")
                .contains("base_raw.[Status Normalizado] NOT IN (N'finished', N'finalizado', N'FINISHED', N'FINALIZADO', N'Finished', N'Finalizado')")
                .contains("base_raw.[Status Carga] IS NULL")
                .contains("base_raw.[Status Carga] NOT IN (N'finished', N'finalizado', N'FINISHED', N'FINALIZADO', N'Finished', N'Finalizado')")
                .contains("base_raw.[Data do frete] >= :inicioOffset AND base_raw.[Data do frete] < :fimOffset")
                .contains("base_raw.[Localização Atual] IN (:filtro_filialAtualCodigos)")
                .doesNotContain("WHERE COALESCE(status_calc.status_norm")
                .doesNotContain("COALESCE(LOWER(status_calc.status_carga)")
                .doesNotContain("__TRACKING_BASE_FILTERS__")
                .contains("base_raw.[Localização Atual]")
                .contains("base_raw.[Filial Emissora]")
                .contains("filial_atual.valor AS [Filial Atual]")
                .contains("responsavel_destino.valor AS [Responsável pela Região de Destino]")
                .contains("responsavel_destino.sigla AS [Sigla Responsável Região Destino]")
                .contains("UPPER(responsavel_destino_raw.responsavel_original) LIKE N'SEM_MAP%'")
                .contains("UPPER(LEFT(responsavel_destino_segmento.sigla_sigla, 3))")
                .contains("N'Sem Responsável'");
        assertThat(query.params().getValues()).containsEntry("filtro_filialAtualCodigos", List.of("ppb"));
    }

    private static FiltroConsultaDTO filtro(Map<String, List<String>> filtros) {
        return new FiltroConsultaDTO(LocalDate.of(2026, 3, 17), LocalDate.of(2026, 4, 16), filtros);
    }
}
