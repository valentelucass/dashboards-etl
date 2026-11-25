package com.dashboard.api.security;

import com.dashboard.api.dto.acesso.PermissaoCatalogoItemDTO;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public enum PermissaoCatalogo {
    COLETAS("coletas", "Coletas", "Dashboard operacional de coletas", "/coletas"),
    MANIFESTOS("manifestos", "Manifestos", "Dashboard operacional de manifestos", "/manifestos"),
    FRETES("fretes", "Faturamento", "Dashboard operacional de faturamento", "/faturamento"),
    PERFORMANCE("performance", "Performance", "Dashboard operacional de performance de entrega", "/performance"),
    REDE_CREDENCIADA("redeCredenciada", "Rede Credenciada", "Desempenho e custos dos parceiros logísticos", "/rede-credenciada"),
    CUSTOMER_SERVICE("customerService", "Customer Service", "Indicadores de atendimento de clientes Key Account", "/customer-service"),
    TRACKING("tracking", "Localização de cargas", "Dashboard de tracking e localização de cargas", "/tracking"),
    FATURAS_POR_CLIENTE("faturasPorCliente", "Financeiro e Recebíveis", "Faturamento, títulos em aberto e recebimentos", "/faturas-por-cliente"),
    CONTAS_A_PAGAR("contasAPagar", "Contas a pagar", "Dashboard financeiro de contas a pagar", "/contas-a-pagar"),
    DRE("dre", "DRE", "Demonstrativo do Resultado do Exercício", "/dre"),
    OCORRENCIAS_SINISTROS("ocorrenciasSinistros", "Ocorrências e Sinistros", "Ocorrências, tratativas e sinistros", "/ocorrencias-e-sinistros"),
    GERENCIAR_SINISTROS("gerenciarSinistros", "Gerenciar sinistros e apólices", "Dados da corretora, franquias, salvados e apólices", null),
    COTACOES("cotacoes", "Cotações", "Dashboard comercial de cotações", "/cotacoes"),
    INDICADORES_GESTAO_A_VISTA("indicadoresGestaoAVista", "Indicadores de Gestão à Vista", "Dashboard operacional de indicadores de gestão à vista", "/indicadores-gestao-a-vista"),
    EXECUTIVO("executivo", "Executivo", "Dashboard executivo consolidado", "/executivo"),
    ETL_SAUDE("etlSaude", "ETL Saúde", "Monitoramento e saúde do ETL", "/etl-saude"),
    INTEGRACOES("integracoes", "Integrações", "Auditoria operacional de dados, eventos e comprovantes por cliente", "/painel/integracoes"),
    DIMENSOES("dimensoes", "Dimensões e filtros", "Acesso às dimensões de apoio aos dashboards", null),
    HOME_COMUNICADOS("homeComunicados", "Comunicações da Home", "Criar, editar e arquivar comunicados exibidos na Home", "/"),
    CAN_MANAGE_KPI_GOALS("can_manage_kpi_goals", "Gerenciar metas de indicadores", "Criar e alterar metas dos Indicadores de Gestão por filial", "/indicadores-gestao-a-vista"),
    CAN_MANAGE_COMMUNICATIONS("can_manage_communications", "Alterar comunicações", "Criar, editar e arquivar comunicados exibidos na Home", "/");

    private final String chave;
    private final String nome;
    private final String descricao;
    private final String rota;

    PermissaoCatalogo(String chave, String nome, String descricao, String rota) {
        this.chave = chave;
        this.nome = nome;
        this.descricao = descricao;
        this.rota = rota;
    }

    public String chave() {
        return chave;
    }

    public String nome() {
        return nome;
    }

    public String descricao() {
        return descricao;
    }

    public String rota() {
        return rota;
    }

    public String authority() {
        return "PERM_" + name();
    }

    public static List<PermissaoCatalogoItemDTO> catalogo() {
        return Arrays.stream(values())
                .map(item -> new PermissaoCatalogoItemDTO(item.chave, item.nome, item.descricao, item.rota))
                .toList();
    }

    public static Map<String, Boolean> mapaVazio() {
        Map<String, Boolean> permissoes = new LinkedHashMap<>();
        for (PermissaoCatalogo permissao : values()) {
            permissoes.put(permissao.chave, false);
        }
        return permissoes;
    }

    public static Map<String, Boolean> mapaCompleto() {
        Map<String, Boolean> permissoes = mapaVazio();
        permissoes.replaceAll((key, value) -> true);
        return permissoes;
    }

    public static String authorityForKey(String chave) {
        return fromKey(chave).authority();
    }

    public static PermissaoCatalogo fromKey(String chave) {
        return Arrays.stream(values())
                .filter(item -> item.chave.equals(chave))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Permissão inválida: " + chave));
    }

    public static List<String> dashboardKeys() {
        return List.of(
                COLETAS.chave,
                MANIFESTOS.chave,
                FRETES.chave,
                PERFORMANCE.chave,
                REDE_CREDENCIADA.chave,
                CUSTOMER_SERVICE.chave,
                TRACKING.chave,
                FATURAS_POR_CLIENTE.chave,
                CONTAS_A_PAGAR.chave,
                DRE.chave,
                OCORRENCIAS_SINISTROS.chave,
                COTACOES.chave,
                INDICADORES_GESTAO_A_VISTA.chave,
                EXECUTIVO.chave,
                ETL_SAUDE.chave,
                INTEGRACOES.chave
        );
    }
}
