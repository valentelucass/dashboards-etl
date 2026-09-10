package com.dashboard.api.service.acesso;

import com.dashboard.api.model.acesso.PermissaoEntity;
import com.dashboard.api.dto.acesso.AcessoResolvidoDTO;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.model.acesso.UsuarioPermissaoOverride;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.repository.acesso.SetorPermissaoTemplateRepository;
import com.dashboard.api.repository.acesso.UsuarioPapelVinculoRepository;
import com.dashboard.api.repository.acesso.UsuarioPermissaoOverrideRepository;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class PermissaoResolverService {

    public static final String PAPEL_ADMIN_PLATAFORMA = "admin_plataforma";
    public static final String PAPEL_ADMIN_ACESSO = "admin_acesso";
    public static final String PAPEL_USUARIO_COMUM = "usuario_comum";

    private final PermissaoRepository permissaoRepository;
    private final SetorPermissaoTemplateRepository templateRepository;
    private final UsuarioPapelVinculoRepository papelVinculoRepository;
    private final UsuarioPermissaoOverrideRepository overrideRepository;
    private final UsuarioSupremo usuarioSupremo;

    public PermissaoResolverService(
            PermissaoRepository permissaoRepository,
            SetorPermissaoTemplateRepository templateRepository,
            UsuarioPapelVinculoRepository papelVinculoRepository,
            UsuarioPermissaoOverrideRepository overrideRepository,
            UsuarioSupremo usuarioSupremo
    ) {
        this.permissaoRepository = permissaoRepository;
        this.templateRepository = templateRepository;
        this.papelVinculoRepository = papelVinculoRepository;
        this.overrideRepository = overrideRepository;
        this.usuarioSupremo = usuarioSupremo;
    }

    public Map<String, Boolean> permissoesEfetivas(UsuarioEntity usuario) {
        return resolverAcesso(usuario).permissoes();
    }

    public AcessoResolvidoDTO resolverAcesso(UsuarioEntity usuario) {
        String papel = papel(Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório."));
        boolean acessoTotal = PAPEL_ADMIN_PLATAFORMA.equals(papel) || usuarioSupremo.papel().equals(papel);
        boolean administrador = acessoTotal || PAPEL_ADMIN_ACESSO.equals(papel);
        return new AcessoResolvidoDTO(papel, administrador, acessoTotal, resolverPermissoes(usuario, acessoTotal));
    }

    private Map<String, Boolean> resolverPermissoes(UsuarioEntity usuario, boolean acessoTotal) {
        Long usuarioId = Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório.");
        List<PermissaoEntity> catalogo = permissaoRepository.findAllByAtivoTrue();

        if (acessoTotal) {
            return catalogoCompleto(catalogo, true);
        }

        Set<Long> templateIds = templateRepository.findAllBySetorId(usuario.getSetor().getId())
                .stream()
                .map(template -> template.getPermissao().getId())
                .collect(Collectors.toSet());

        List<UsuarioPermissaoOverride> todosOverrides = overrideRepository.findAllByUsuarioId(usuarioId);
        Set<Long> negadas = todosOverrides.stream()
                .filter(override -> "DENY".equals(override.getTipo()))
                .map(override -> override.getPermissao().getId())
                .collect(Collectors.toSet());
        Set<Long> concedidas = todosOverrides.stream()
                .filter(override -> "GRANT".equals(override.getTipo()))
                .map(override -> override.getPermissao().getId())
                .collect(Collectors.toSet());

        Map<String, Boolean> resultado = new LinkedHashMap<>();
        for (PermissaoEntity permissao : catalogo) {
            String chave = permissao.getChaveLegado() != null ? permissao.getChaveLegado() : permissao.getChave();
            resultado.put(chave, (templateIds.contains(permissao.getId()) && !negadas.contains(permissao.getId()))
                    || concedidas.contains(permissao.getId()));
        }

        return resultado;
    }

    public boolean ehAdminPlataforma(Long usuarioId) {
        return PAPEL_ADMIN_PLATAFORMA.equals(papel(usuarioId));
    }

    public boolean ehDesenvolvedor(Long usuarioId) {
        return usuarioSupremo.papel().equals(papel(usuarioId));
    }

    public boolean ehAdminAcesso(Long usuarioId) {
        String papel = papel(usuarioId);
        return usuarioSupremo.papel().equals(papel)
                || PAPEL_ADMIN_PLATAFORMA.equals(papel)
                || PAPEL_ADMIN_ACESSO.equals(papel);
    }

    public boolean ehAdmin(Long usuarioId) {
        return ehAdminAcesso(usuarioId);
    }

    public String papel(Long usuarioId) {
        return papelVinculoRepository.findAllByUsuarioId(usuarioId)
                .stream()
                .map(vinculo -> vinculo.getPapel())
                .sorted((a, b) -> Integer.compare(b.getNivel(), a.getNivel()))
                .map(papel -> papel.getNome())
                .findFirst()
                .orElse(PAPEL_USUARIO_COMUM);
    }

    private Map<String, Boolean> catalogoCompleto(List<PermissaoEntity> catalogo, boolean valor) {
        Map<String, Boolean> mapa = new LinkedHashMap<>();
        for (PermissaoEntity permissao : catalogo) {
            String chave = permissao.getChaveLegado() != null ? permissao.getChaveLegado() : permissao.getChave();
            mapa.put(chave, valor);
        }
        return mapa;
    }
}
