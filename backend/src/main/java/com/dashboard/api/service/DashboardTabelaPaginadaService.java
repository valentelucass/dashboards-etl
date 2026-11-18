package com.dashboard.api.service;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.coletas.ColetaResumoDTO;
import com.dashboard.api.dto.contaspagar.ContaPagarResumoDTO;
import com.dashboard.api.dto.cotacoes.CotacaoResumoDTO;
import com.dashboard.api.dto.etl.EtlExecucaoResumoDTO;
import com.dashboard.api.dto.faturascliente.FaturaPorClienteResumoDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.fretes.FreteResumoDTO;
import com.dashboard.api.dto.manifestos.ManifestoResumoDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.dto.tracking.TrackingResumoDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.ConsultaFiltroUtils;
import com.dashboard.api.util.ConsultaLimiteUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.function.Function;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DashboardTabelaPaginadaService {

    private static final int PAGINA_PADRAO = 1;
    private static final int TAMANHO_PADRAO = 10;
    private static final int TAMANHO_MAXIMO = 100;
    private static final int TAMANHO_MAXIMO_TABELA_LEGADA = 200;
    private static final Map<String, ManifestosSortDefinition> MANIFESTOS_SORT_FIELDS = Map.ofEntries(
            Map.entry("numero", new ManifestosSortDefinition("[Número]", null)),
            Map.entry("status", new ManifestosSortDefinition("[Status]", null)),
            Map.entry("filial", new ManifestosSortDefinition("[Filial]", null)),
            Map.entry("motorista", new ManifestosSortDefinition("[Motorista]", null)),
            Map.entry("veiculoPlaca", new ManifestosSortDefinition("[Veículo/Placa]", null)),
            Map.entry("dataCriacao", new ManifestosSortDefinition("[Data criação]", null)),
            Map.entry("totalPesoTaxado", new ManifestosSortDefinition("[Total peso taxado]", null)),
            Map.entry("totalM3", new ManifestosSortDefinition("[Total M3]", null)),
            Map.entry("custoTotal", new ManifestosSortDefinition("[Custo total]", null)),
            Map.entry("receitaTotalTransportada", new ManifestosSortDefinition("[Receita Total Transportada]", null)),
            Map.entry("kmTotal", new ManifestosSortDefinition("[KM Total]", null)),
            Map.entry("percentualRemuneracao", new ManifestosSortDefinition(
                    "CASE WHEN [Receita Total Transportada] BETWEEN 0.01 AND 5.00 THEN 1 WHEN [Receita Total Transportada] = 0 AND [Custo total] > 0 THEN 1 ELSE ([Custo total] / NULLIF([Receita Total Transportada], 0)) END",
                    "(([Receita Total Transportada] > 0) OR ([Receita Total Transportada] = 0 AND [Custo total] > 0)) AND [Custo total] IS NOT NULL"
            )),
            Map.entry("percentualAproveitamento", new ManifestosSortDefinition(
                    "[Total peso taxado] / NULLIF([Capacidade Lotação Kg], 0)",
                    "[Capacidade Lotação Kg] > 0 AND [Total peso taxado] IS NOT NULL"
            )),
            Map.entry("percentualEfetividade", new ManifestosSortDefinition(
                    "CONVERT(DECIMAL(19, 6), [Itens/Finalizados]) / NULLIF([Itens/Total], 0)",
                    "[Itens/Total] > 0 AND [Itens/Finalizados] IS NOT NULL"
            ))
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final DashboardExportSqlBuilder sqlBuilder;
    private final ValidadorPeriodoService validadorPeriodo;
    private final EscopoFilialService escopoFilialService;

    public DashboardTabelaPaginadaService(
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder,
            ValidadorPeriodoService validadorPeriodo,
            EscopoFilialService escopoFilialService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.sqlBuilder = sqlBuilder;
        this.validadorPeriodo = validadorPeriodo;
        this.escopoFilialService = escopoFilialService;
    }

    public PaginaDTO<ColetaResumoDTO> buscarColetas(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.COLETAS, filtro, pagina, tamanhoPagina, this::mapearColeta);
    }

    public List<ColetaResumoDTO> buscarPrimeiraPaginaColetas(FiltroConsultaDTO filtro, int limite) {
        return buscarPrimeiraPagina(DashboardExportDefinition.COLETAS, filtro, limite, this::mapearColeta);
    }

    public PaginaDTO<FreteResumoDTO> buscarFretes(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.FRETES, filtro, pagina, tamanhoPagina, this::mapearFrete);
    }

    public PaginaDTO<TrackingResumoDTO> buscarTracking(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.TRACKING, filtro, pagina, tamanhoPagina, this::mapearTracking);
    }

    public List<TrackingResumoDTO> buscarPrimeiraPaginaTracking(FiltroConsultaDTO filtro, int limite) {
        return buscarPrimeiraPagina(DashboardExportDefinition.TRACKING, filtro, limite, this::mapearTracking);
    }

    public PaginaDTO<ManifestoResumoDTO> buscarManifestos(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarManifestos(filtro, pagina, tamanhoPagina, null, null);
    }

    public PaginaDTO<ManifestoResumoDTO> buscarManifestos(
            FiltroConsultaDTO filtro,
            int pagina,
            int tamanhoPagina,
            String sortField,
            String sortDirection
    ) {
        return buscarPagina(
                DashboardExportDefinition.MANIFESTOS,
                filtro,
                pagina,
                tamanhoPagina,
                this::mapearManifesto,
                manifestosOrderBy(sortField, sortDirection)
        );
    }

    public PaginaDTO<CotacaoResumoDTO> buscarCotacoes(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.COTACOES, filtro, pagina, tamanhoPagina, this::mapearCotacao);
    }

    public PaginaDTO<ContaPagarResumoDTO> buscarContasAPagar(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.CONTAS_A_PAGAR, filtro, pagina, tamanhoPagina, this::mapearContaPagar);
    }

    public List<ContaPagarResumoDTO> buscarPrimeiraPaginaContasAPagar(FiltroConsultaDTO filtro, int limite) {
        return buscarPrimeiraPagina(DashboardExportDefinition.CONTAS_A_PAGAR, filtro, limite, this::mapearContaPagar);
    }

    public PaginaDTO<FaturaPorClienteResumoDTO> buscarFaturasPorCliente(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.FATURAS_POR_CLIENTE, filtro, pagina, tamanhoPagina, this::mapearFaturaPorCliente);
    }

    public List<FaturaPorClienteResumoDTO> buscarPrimeiraPaginaFaturasPorCliente(FiltroConsultaDTO filtro, int limite) {
        return buscarPrimeiraPagina(DashboardExportDefinition.FATURAS_POR_CLIENTE, filtro, limite, this::mapearFaturaPorCliente);
    }

    public PaginaDTO<EtlExecucaoResumoDTO> buscarEtlSaude(FiltroConsultaDTO filtro, int pagina, int tamanhoPagina) {
        return buscarPagina(DashboardExportDefinition.ETL_SAUDE, filtro, pagina, tamanhoPagina, this::mapearEtlSaude);
    }

    private <T> PaginaDTO<T> buscarPagina(
            DashboardExportDefinition definition,
            FiltroConsultaDTO filtro,
            int paginaSolicitada,
            int tamanhoSolicitado,
            Function<Map<String, Object>, T> mapper
    ) {
        return buscarPagina(definition, filtro, paginaSolicitada, tamanhoSolicitado, mapper, definition.orderBy());
    }

    private <T> PaginaDTO<T> buscarPagina(
            DashboardExportDefinition definition,
            FiltroConsultaDTO filtro,
            int paginaSolicitada,
            int tamanhoSolicitado,
            Function<Map<String, Object>, T> mapper,
            List<String> orderBy
    ) {
        PaginaDTO<Map<String, Object>> pagina = buscarPaginaBruta(
                definition,
                filtro,
                paginaSolicitada,
                tamanhoSolicitado,
                TAMANHO_MAXIMO,
                orderBy
        );
        return copiarPagina(pagina, pagina.conteudo().stream().map(mapper).toList());
    }

    private <T> List<T> buscarPrimeiraPagina(
            DashboardExportDefinition definition,
            FiltroConsultaDTO filtro,
            int limite,
            Function<Map<String, Object>, T> mapper
    ) {
        return buscarPaginaBruta(
                definition,
                filtro,
                PAGINA_PADRAO,
                limite,
                TAMANHO_MAXIMO_TABELA_LEGADA,
                definition.orderBy()
        ).conteudo().stream().map(mapper).toList();
    }

    private PaginaDTO<Map<String, Object>> buscarPaginaBruta(
            DashboardExportDefinition definition,
            FiltroConsultaDTO filtro,
            int paginaSolicitada,
            int tamanhoSolicitado,
            int tamanhoMaximo,
            List<String> orderBy
    ) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());

        int pagina = Math.max(PAGINA_PADRAO, paginaSolicitada);
        int tamanho = ConsultaLimiteUtils.limitar(tamanhoSolicitado, TAMANHO_PADRAO, tamanhoMaximo);
        long offset = (long) (pagina - 1) * tamanho;
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();

        DashboardExportSqlBuilder.ExportSql countQuery = sqlBuilder.buildCount(definition, filtro, escopo, Set.of());
        String countSql = Objects.requireNonNull(countQuery.sql(), "countSql");
        MapSqlParameterSource countParams = Objects.requireNonNull(countQuery.params(), "countParams");
        Long total = jdbcTemplate.queryForObject(countSql, countParams, Long.class);

        DashboardExportSqlBuilder.ExportSql selectQuery = sqlBuilder.buildPage(
                definition,
                filtro,
                escopo,
                orderBy
        );
        MapSqlParameterSource params = Objects.requireNonNull(selectQuery.params(), "selectParams");
        params.addValue("offsetTabela", offset);
        params.addValue("tamanhoTabela", tamanho);

        String sql = Objects.requireNonNull(selectQuery.sql(), "selectSql");
        List<Map<String, Object>> conteudo = jdbcTemplate.queryForList(sql, params);
        long totalSeguro = total != null ? total : 0L;
        int totalPaginas = totalSeguro == 0 ? 0 : (int) Math.ceil(totalSeguro / (double) tamanho);

        return new PaginaDTO<>(conteudo, totalSeguro, totalPaginas, pagina, tamanho);
    }

    private List<String> manifestosOrderBy(String sortField, String sortDirection) {
        if (sortField == null) {
            return DashboardExportDefinition.MANIFESTOS.orderBy();
        }

        ManifestosSortDefinition sortDefinition = MANIFESTOS_SORT_FIELDS.get(sortField);
        if (sortDefinition == null) {
            return DashboardExportDefinition.MANIFESTOS.orderBy();
        }

        String direction = "desc".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";
        List<String> orderBy = new ArrayList<>();
        if (sortDefinition.validCondition() != null) {
            orderBy.add("CASE WHEN " + sortDefinition.validCondition() + " THEN 0 ELSE 1 END ASC");
        }
        orderBy.add(sortDefinition.expression() + " " + direction);
        if (!"dataCriacao".equals(sortField)) {
            orderBy.add("[Data criação] DESC");
        }
        if (!"numero".equals(sortField)) {
            orderBy.add("[Número] DESC");
        }
        return List.copyOf(orderBy);
    }

    private <T> PaginaDTO<T> copiarPagina(PaginaDTO<?> origem, List<T> conteudo) {
        return new PaginaDTO<>(
                conteudo,
                origem.totalElementos(),
                origem.totalPaginas(),
                origem.paginaAtual(),
                origem.tamanhoPagina()
        );
    }

    private ColetaResumoDTO mapearColeta(Map<String, Object> row) {
        return new ColetaResumoDTO(
                texto(row, "ID"),
                longo(row, "Coleta"),
                texto(row, "Solicitacao"),
                texto(row, "Agendamento"),
                texto(row, "Finalizacao"),
                inteiro(row, "Dias em Aberto"),
                texto(row, "Status"),
                inteiro(row, "Volumes"),
                decimal(row, "Peso Taxado"),
                decimal(row, "Valor NF"),
                longo(row, "Numero Manifesto"),
                texto(row, "Cliente"),
                texto(row, "Cidade"),
                texto(row, "UF"),
                texto(row, "Região da Coleta", "Regiao da Coleta"),
                texto(row, "Região Logística", "Regiao Logistica"),
                texto(row, "Filial"),
                texto(row, "Usuario", "Usuário"),
                texto(row, "Motivo Cancel."),
                inteiro(row, "Nº Tentativas", "N° Tentativas")
        );
    }

    private FreteResumoDTO mapearFrete(Map<String, Object> row) {
        return new FreteResumoDTO(
                longo(row, "frete_id", "ID"),
                longo(row, "numero_minuta", "Nº Minuta", "N° Minuta"),
                texto(row, "data_referencia_faturamento", "Data frete", "data_frete"),
                origemDataFaturamento(row),
                texto(row, "status_frete", "Status"),
                texto(row, "filial_nome", "Filial"),
                texto(row, "pagador_nome", "Pagador"),
                texto(row, "remetente_nome", "Remetente"),
                texto(row, "destinatario_nome", "Destinatario", "Destinatário"),
                texto(row, "origem_uf", "UF Origem"),
                texto(row, "destino_uf", "UF Destino"),
                decimal(row, "receita_bruta", "Valor Total do Serviço", "Valor Total do Servico"),
                decimal(row, "valor_frete", "Valor Frete"),
                decimal(row, "peso_taxado", "Peso Taxado", "Kg Taxado"),
                inteiro(row, "volumes", "Volumes"),
                texto(row, "previsao_entrega", "Previsão de Entrega", "Previsao de Entrega"),
                documentoTipoFrete(row),
                inteiro(row, "numero_cte", "Nº CT-e", "N° CT-e"),
                inteiro(row, "nfse_number", "Nº NFS-e", "N° NFS-e"),
                decimal(row, "valor_icms", "Valor ICMS"),
                decimal(row, "valor_pis", "Valor PIS"),
                decimal(row, "valor_cofins", "Valor COFINS")
        );
    }

    private TrackingResumoDTO mapearTracking(Map<String, Object> row) {
        return new TrackingResumoDTO(
                longo(row, "N° Minuta", "Nº Minuta"),
                texto(row, "Data do frete"),
                texto(row, "Tipo"),
                inteiro(row, "Volumes"),
                decimal(row, "Peso Taxado Decimal", "Peso Taxado"),
                decimal(row, "Valor NF Decimal", "Valor NF"),
                decimal(row, "Valor Frete"),
                texto(row, "Filial Emissora"),
                texto(row, "Filial Origem"),
                texto(row, "Filial Atual"),
                texto(row, "Filial Destino"),
                texto(row, "Região Origem", "Regiao Origem"),
                texto(row, "Região Destino", "Regiao Destino"),
                texto(row, "Classificação", "Classificacao"),
                texto(row, "Status Carga"),
                texto(row, "Previsão Entrega/Previsão de entrega", "Previsao Entrega/Previsao de entrega")
        );
    }

    private ManifestoResumoDTO mapearManifesto(Map<String, Object> row) {
        return new ManifestoResumoDTO(
                longo(row, "Número", "Numero"),
                texto(row, "Identificador Único", "Identificador Unico"),
                texto(row, "Status"),
                texto(row, "Classificação", "Classificacao"),
                texto(row, "Filial"),
                texto(row, "Data criação", "Data criacao"),
                texto(row, "Fechamento"),
                texto(row, "Motorista"),
                texto(row, "Veículo/Placa", "Veiculo/Placa"),
                texto(row, "Tipo Veículo", "Tipo Veiculo"),
                decimal(row, "Total peso taxado"),
                decimal(row, "Total M3"),
                decimal(row, "Custo total"),
                decimal(row, "Valor frete"),
                decimal(row, "Combustível", "Combustivel"),
                decimal(row, "Pedágio", "Pedagio"),
                decimal(row, "Saldo a pagar"),
                decimal(row, "KM Total"),
                decimal(row, "Receita Total Transportada"),
                decimal(row, "Capacidade Lotação Kg", "Capacidade Lotacao Kg"),
                inteiro(row, "Itens/Finalizados"),
                inteiro(row, "Itens/Total")
        );
    }

    private record ManifestosSortDefinition(String expression, String validCondition) {
    }

    private CotacaoResumoDTO mapearCotacao(Map<String, Object> row) {
        BigDecimal pesoTaxado = decimal(row, "Peso taxado", "Peso Taxado", "Peso");
        BigDecimal valorNf = decimal(row, "Valor NF");
        BigDecimal valorFrete = decimal(row, "Valor frete", "Valor Frete");
        return new CotacaoResumoDTO(
                longo(row, "N° Cotação", "Nº Cotação", "N° Cotacao", "Nº Cotacao"),
                texto(row, "Data Cotação", "Data Cotacao"),
                texto(row, "Filial"),
                texto(row, "Solicitante"),
                texto(row, "Cliente Pagador"),
                texto(row, "Cliente"),
                texto(row, "Trecho"),
                valorFrete,
                texto(row, "Status Conversão", "Status Conversao"),
                texto(row, "Motivo Perda"),
                texto(row, "Tipo de operação", "Tipo de operacao", "Classificação", "Classificacao"),
                inteiro(row, "Volume", "Volumes"),
                pesoTaxado,
                dividir(valorFrete, pesoTaxado),
                decimal(row, "Min. Frete/KG", "Min. R$/KG"),
                valorNf,
                percentualDecimal(valorFrete, valorNf),
                texto(row, "Tabela"),
                texto(row, "Origem"),
                texto(row, "Destino"),
                texto(row, "CT-e/Data de emissão", "CT-e/Data de emissao"),
                texto(row, "Nfse/Data de emissão", "Nfse/Data de emissao")
        );
    }

    private ContaPagarResumoDTO mapearContaPagar(Map<String, Object> row) {
        return new ContaPagarResumoDTO(
                longo(row, "Lançamento a Pagar/N°", "Lancamento a Pagar/N°", "Lançamento a Pagar/Nº"),
                texto(row, "N° Documento", "Nº Documento"),
                texto(row, "Emissão", "Emissao"),
                texto(row, "Tipo"),
                texto(row, "Filial"),
                texto(row, "Fornecedor/Nome"),
                decimal(row, "Valor"),
                decimal(row, "Valor pago"),
                decimal(row, "Valor a pagar"),
                texto(row, "Conta Contábil/Classificação", "Conta Contabil/Classificacao"),
                texto(row, "Conta Contábil/Descrição", "Conta Contabil/Descricao"),
                texto(row, "Centro de custo/Nome"),
                texto(row, "Baixa/Data liquidação", "Baixa/Data liquidacao"),
                texto(row, "Pago"),
                texto(row, "Conciliado")
        );
    }

    private FaturaPorClienteResumoDTO mapearFaturaPorCliente(Map<String, Object> row) {
        return new FaturaPorClienteResumoDTO(
                texto(row, "unique_id", "ID Único", "ID Unico"),
                documentoFaturaOperacional(row),
                emissaoFaturaOperacional(row),
                vencimentoFaturaOperacional(row),
                baixaFaturaOperacional(row),
                texto(row, "filial", "Filial"),
                texto(row, "pagador_nome", "Pagador do frete/Nome"),
                clienteCnpjOperacional(row),
                longo(row, "numero_cte", "CT-e/Número", "CT-e/Numero"),
                valorOperacionalFatura(row),
                statusProcesso(row)
        );
    }

    private EtlExecucaoResumoDTO mapearEtlSaude(Map<String, Object> row) {
        return new EtlExecucaoResumoDTO(
                longo(row, "Id", "ID"),
                texto(row, "Inicio"),
                texto(row, "Fim"),
                inteiro(row, "Duracao (s)", "Duração (s)"),
                texto(row, "Data"),
                texto(row, "Status"),
                inteiro(row, "Total Registros"),
                texto(row, "Categoria Erro"),
                texto(row, "Mensagem Erro")
        );
    }

    private String documentoTipoFrete(Map<String, Object> row) {
        if (valor(row, "cte_id", "CT-e ID") != null) {
            return "CT-e";
        }
        if (valor(row, "nfse_number", "Nº NFS-e", "N° NFS-e") != null) {
            return "NFS-e";
        }
        return "Pendente";
    }

    private String origemDataFaturamento(Map<String, Object> row) {
        String cteEmissao = texto(row, "data_emissao_cte", "CT-e Emissão", "CT-e Emissao");
        return cteEmissao != null && !cteEmissao.isBlank() ? "CT-e Emissão" : "Data do Frete";
    }

    private BigDecimal valorOperacionalFatura(Map<String, Object> row) {
        Object valorOperacional = valor(row, "valor_operacional");
        if (valorOperacional != null) {
            return decimalObjeto(valorOperacional);
        }

        Object valorFitAnt = viewFaturasClienteDeslocada(row)
                ? valor(row, "Fatura/Valor Total")
                : valor(row, "Fatura/Valor");
        if (valorFitAnt != null) {
            return decimalObjeto(valorFitAnt);
        }
        Object valorFatura = viewFaturasClienteDeslocada(row)
                ? valor(row, "Fatura/Número", "Fatura/Numero")
                : valor(row, "Fatura/Valor Total");
        if (valorFatura != null) {
            return decimalObjeto(valorFatura);
        }
        return decimal(row, "Frete/Valor dos CT-es");
    }

    private String statusProcesso(Map<String, Object> row) {
        String status = texto(row, "status_processo");
        if (status != null && !status.isBlank()) {
            return status;
        }

        String documento = texto(row, "Fatura/N° Documento", "Fatura/Nº Documento");
        if (ehStatusProcesso(documento)) {
            return documento;
        }
        return documento != null && !documento.isBlank() ? "Faturado" : "Aguardando Faturamento";
    }

    private boolean viewFaturasClienteDeslocada(Map<String, Object> row) {
        return ehStatusProcesso(texto(row, "Fatura/N° Documento", "Fatura/Nº Documento"));
    }

    private boolean ehStatusProcesso(String valor) {
        return valor != null
                && (valor.equalsIgnoreCase("Faturado")
                || valor.equalsIgnoreCase("Aguardando Faturamento"));
    }

    private String documentoFaturaOperacional(Map<String, Object> row) {
        String documento = texto(row, "documento_fatura", "numero_fatura", "numero_documento");
        if (documento != null && !documento.isBlank()) {
            return documento;
        }

        return viewFaturasClienteDeslocada(row)
                ? texto(row, "Fatura/Emissão", "Fatura/Emissao")
                : texto(row, "Fatura/N° Documento", "Fatura/Nº Documento");
    }

    private String emissaoFaturaOperacional(Map<String, Object> row) {
        String emissao = texto(row, "data_emissao_fatura", "data_emissao_cte_date", "data_emissao_cte");
        if (emissao != null && !emissao.isBlank()) {
            return emissao;
        }

        if (viewFaturasClienteDeslocada(row)) {
            return texto(row, "Fatura/Valor", "CT-e/Data de emissão", "CT-e/Data de emissao");
        }
        return texto(row, "Fatura/Emissão", "Fatura/Emissao", "Fatura/Emissão Fatura", "Fatura/Emissao Fatura", "CT-e/Data de emissão", "CT-e/Data de emissao");
    }

    private String vencimentoFaturaOperacional(Map<String, Object> row) {
        String vencimento = texto(row, "data_vencimento_fatura");
        if (vencimento != null && !vencimento.isBlank()) {
            return vencimento;
        }

        return viewFaturasClienteDeslocada(row)
                ? texto(row, "Fatura/Baixa")
                : texto(row, "Parcelas/Vencimento");
    }

    private String baixaFaturaOperacional(Map<String, Object> row) {
        String baixa = texto(row, "data_baixa_fatura");
        if (baixa != null && !baixa.isBlank()) {
            return baixa;
        }

        return viewFaturasClienteDeslocada(row)
                ? texto(row, "Fatura/Data Vencimento Original")
                : texto(row, "Fatura/Baixa");
    }

    private String clienteCnpjOperacional(Map<String, Object> row) {
        String clienteCnpj = texto(row, "cliente_cnpj", "cliente_cnpj_key", "pagador_documento", "pagador_documento_key");
        if (clienteCnpj != null && !clienteCnpj.isBlank()) {
            return clienteCnpj;
        }

        return viewFaturasClienteDeslocada(row)
                ? texto(row, "Remetente/Nome", "Pagador do frete/Documento")
                : texto(row, "Cliente/CNPJ", "Pagador do frete/Documento");
    }

    private Object valor(Map<String, Object> row, String... colunas) {
        for (String coluna : colunas) {
            Object valor = row.get(coluna);
            if (valor != null) {
                return valor;
            }
        }
        return null;
    }

    private String texto(Map<String, Object> row, String... colunas) {
        Object valor = valor(row, colunas);
        return valor != null ? valor.toString() : null;
    }

    private Long longo(Map<String, Object> row, String... colunas) {
        Object valor = valor(row, colunas);
        if (valor == null) {
            return null;
        }
        if (valor instanceof Number numero) {
            return numero.longValue();
        }
        String texto = valor.toString().trim();
        if (texto.isEmpty()) {
            return null;
        }
        BigDecimal decimal = ConsultaFiltroUtils.parseBigDecimalOrNull(texto);
        return decimal != null ? decimal.longValue() : null;
    }

    private Integer inteiro(Map<String, Object> row, String... colunas) {
        Object valor = valor(row, colunas);
        if (valor == null) {
            return null;
        }
        if (valor instanceof Number numero) {
            return numero.intValue();
        }
        String texto = valor.toString().trim();
        if (texto.isEmpty()) {
            return null;
        }
        BigDecimal decimal = ConsultaFiltroUtils.parseBigDecimalOrNull(texto);
        return decimal != null ? decimal.intValue() : null;
    }

    private BigDecimal decimal(Map<String, Object> row, String... colunas) {
        return decimalObjeto(valor(row, colunas));
    }

    private BigDecimal dividir(BigDecimal valor, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return ConsultaFiltroUtils.zeroSeNulo(valor)
                .divide(total, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentualDecimal(BigDecimal valor, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return ConsultaFiltroUtils.zeroSeNulo(valor)
                .multiply(BigDecimal.valueOf(100))
                .divide(total, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal decimalObjeto(Object valor) {
        if (valor == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (valor instanceof BigDecimal decimal) {
            return decimal.setScale(2, RoundingMode.HALF_UP);
        }
        if (valor instanceof Number numero) {
            return BigDecimal.valueOf(numero.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        return ConsultaFiltroUtils.parseBigDecimal(valor.toString()).setScale(2, RoundingMode.HALF_UP);
    }

}
