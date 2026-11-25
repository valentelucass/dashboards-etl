package com.dashboard.api.service.acesso;

import com.dashboard.api.model.acesso.PermissaoEntity;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.security.PermissaoCatalogo;
import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(5)
public class PermissaoCatalogoBootstrapService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PermissaoCatalogoBootstrapService.class);

    private final PermissaoRepository permissaoRepository;

    public PermissaoCatalogoBootstrapService(PermissaoRepository permissaoRepository) {
        this.permissaoRepository = permissaoRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Arrays.stream(PermissaoCatalogo.values()).forEach(this::sincronizarPermissao);
    }

    private void sincronizarPermissao(PermissaoCatalogo catalogo) {
        String recurso = normalizarRecurso(catalogo);
        String acao = catalogo == PermissaoCatalogo.GERENCIAR_SINISTROS ? "write" : "read";
        String chave = "dashboard." + recurso + "." + acao;
        PermissaoEntity permissao = permissaoRepository.findByChaveLegado(catalogo.chave())
                .or(() -> permissaoRepository.findByChave(chave))
                .orElseGet(PermissaoEntity::new);

        permissao.setChave(chave);
        permissao.setChaveLegado(catalogo.chave());
        permissao.setNome(catalogo.nome());
        permissao.setDescricao(catalogo.descricao());
        permissao.setRecurso(recurso);
        permissao.setAcao(acao);
        permissao.setRota(catalogo.rota());
        permissao.setAtivo(true);

        permissaoRepository.save(permissao);
        log.debug("Permissão sincronizada: {}", catalogo.chave());
    }

    private String normalizarRecurso(PermissaoCatalogo catalogo) {
        return switch (catalogo) {
            case OCORRENCIAS_SINISTROS, GERENCIAR_SINISTROS -> "sinistros";
            case FATURAS_POR_CLIENTE -> "faturas_por_cliente";
            case CONTAS_A_PAGAR -> "contas_a_pagar";
            case ETL_SAUDE -> "etl_saude";
            case INDICADORES_GESTAO_A_VISTA -> "indicadores_gestao_a_vista";
            case CAN_MANAGE_KPI_GOALS -> "can_manage_kpi_goals";
            case CAN_MANAGE_COMMUNICATIONS -> "can_manage_communications";
            default -> catalogo.chave();
        };
    }
}
