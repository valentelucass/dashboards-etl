package com.dashboard.api.service.acesso;

import com.dashboard.api.dto.acesso.PapelDTO;
import com.dashboard.api.dto.acesso.UsuarioAcessoDTO;
import com.dashboard.api.dto.acesso.UsuarioOnlineResumoDTO;
import com.dashboard.api.dto.acesso.UsuarioRequestDTO;
import com.dashboard.api.dto.acesso.UsuarioSessaoResumoDTO;
import com.dashboard.api.model.acesso.AcaoAudit;
import com.dashboard.api.model.acesso.PapelEntity;
import com.dashboard.api.model.acesso.PermissaoEntity;
import com.dashboard.api.model.acesso.SetorEntity;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.model.acesso.UsuarioPapelVinculo;
import com.dashboard.api.model.acesso.UsuarioPermissaoOverride;
import com.dashboard.api.policy.EscopoFiliaisUsuarioPolicy;
import com.dashboard.api.repository.acesso.EscopoFiliaisUsuarioStore;
import com.dashboard.api.repository.acesso.PapelRepository;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.repository.acesso.SetorPermissaoTemplateRepository;
import com.dashboard.api.repository.acesso.SetorRepository;
import com.dashboard.api.repository.acesso.UsuarioPapelVinculoRepository;
import com.dashboard.api.repository.acesso.UsuarioPermissaoOverrideRepository;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GestaoUsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final SetorRepository setorRepository;
    private final PapelRepository papelRepository;
    private final UsuarioPapelVinculoRepository papelVinculoRepository;
    private final UsuarioPermissaoOverrideRepository overrideRepository;
    private final PermissaoRepository permissaoRepository;
    private final SetorPermissaoTemplateRepository templateRepository;
    private final PasswordHashService passwordHashService;
    private final PermissaoResolverService permissaoResolver;
    private final AuditService auditService;
    private final PoliticaSenhaService politicaSenhaService;
    private final RefreshTokenService refreshTokenService;
    private final UsuarioSupremo usuarioSupremo;
    private final EscopoFiliaisUsuarioStore escopoFiliaisUsuarioStore;

    public GestaoUsuarioService(
            UsuarioRepository usuarioRepository,
            SetorRepository setorRepository,
            PapelRepository papelRepository,
            UsuarioPapelVinculoRepository papelVinculoRepository,
            UsuarioPermissaoOverrideRepository overrideRepository,
            PermissaoRepository permissaoRepository,
            SetorPermissaoTemplateRepository templateRepository,
            PasswordHashService passwordHashService,
            PermissaoResolverService permissaoResolver,
            AuditService auditService,
            PoliticaSenhaService politicaSenhaService,
            RefreshTokenService refreshTokenService,
            UsuarioSupremo usuarioSupremo,
            EscopoFiliaisUsuarioStore escopoFiliaisUsuarioStore
    ) {
        this.usuarioRepository = usuarioRepository;
        this.setorRepository = setorRepository;
        this.papelRepository = papelRepository;
        this.papelVinculoRepository = papelVinculoRepository;
        this.overrideRepository = overrideRepository;
        this.permissaoRepository = permissaoRepository;
        this.templateRepository = templateRepository;
        this.passwordHashService = passwordHashService;
        this.permissaoResolver = permissaoResolver;
        this.auditService = auditService;
        this.politicaSenhaService = politicaSenhaService;
        this.refreshTokenService = refreshTokenService;
        this.usuarioSupremo = usuarioSupremo;
        this.escopoFiliaisUsuarioStore = escopoFiliaisUsuarioStore;
    }

    @Transactional(readOnly = true)
    public List<UsuarioAcessoDTO> listarUsuarios() {
        boolean exibirSolicitacaoRedefinicao = operadorEhUsuarioSupremo();
        List<UsuarioRepository.UsuarioAcessoResumoProjection> usuarios = Boolean.TRUE.equals(usuarioRepository.existeColunaUltimaRotaAcessada())
                ? usuarioRepository.findAcessoResumo()
                : usuarioRepository.findAcessoResumoSemUltimaRota();
        if (usuarios.isEmpty()) {
            return List.of();
        }

        List<Long> usuarioIds = usuarios.stream()
                .map(UsuarioRepository.UsuarioAcessoResumoProjection::getId)
                .filter(Objects::nonNull)
                .toList();
        List<Long> setorIds = usuarios.stream()
                .map(UsuarioRepository.UsuarioAcessoResumoProjection::getSetorId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<PermissaoRepository.PermissaoResumoProjection> catalogoPermissoes = permissaoRepository.findCatalogoAtivoResumo();
        Map<Long, String> papeisPorUsuario = listarPapeisPorUsuario(usuarioIds);
        Map<Long, List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection>> overridesPorUsuario =
                listarOverridesPorUsuario(usuarioIds);
        Map<Long, Set<Long>> templatesPorSetor = listarTemplatesPorSetor(setorIds);
        Map<Long, List<String>> filiaisPorSetor = listarFiliaisPorSetor(setorIds);
        Map<Long, EscopoFiliaisUsuarioStore.EscopoUsuario> escoposPorUsuario =
                escopoFiliaisUsuarioStore.carregarPorUsuarios(usuarioIds);

        return usuarios.stream()
                .map(usuario -> mapearUsuarioResumo(
                        usuario,
                        catalogoPermissoes,
                        papeisPorUsuario,
                        overridesPorUsuario,
                        templatesPorSetor,
                        filiaisPorSetor,
                        escoposPorUsuario,
                        exibirSolicitacaoRedefinicao
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public UsuarioSessaoResumoDTO resumoSessoesUsuarios() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String operador = authentication == null ? "" : authentication.getName();
        UsuarioRepository.UsuarioSessaoResumoProjection resumo = usuarioRepository.calcularResumoSessoes(operador);
        if (resumo == null) {
            return new UsuarioSessaoResumoDTO(0, 0, 0, 0);
        }

        List<UsuarioOnlineResumoDTO> usuariosOnline = usuarioRepository.findUsuariosOnlineResumo(operador).stream()
                .map(this::resumoPresenca)
                .toList();
        List<UsuarioOnlineResumoDTO> usuariosRecentes = usuarioRepository.findUsuariosRecentesResumo(operador).stream()
                .map(this::resumoPresenca)
                .toList();

        return new UsuarioSessaoResumoDTO(
                valorLong(resumo.getTotalUsuarios()),
                valorLong(resumo.getUsuariosAtivos()),
                valorLong(resumo.getUsuariosInativos()),
                valorLong(resumo.getUsuariosOnline()),
                usuariosOnline,
                operadorEhUsuarioSupremo(),
                usuariosRecentes
        );
    }

    private UsuarioOnlineResumoDTO resumoPresenca(UsuarioRepository.UsuarioOnlineResumoProjection usuario) {
        return new UsuarioOnlineResumoDTO(String.valueOf(usuario.getId()), usuario.getNome(), usuario.getEmail(),
                parseUltimaAtividade(usuario.getUltimaAtividade()), formatarRotaNegocio(usuario.getUltimaRotaAcessada()));
    }

    @Transactional
    public UsuarioAcessoDTO criarUsuario(UsuarioRequestDTO request) {
        if (request.senha() == null || request.senha().isBlank()) {
            throw new IllegalArgumentException("A senha é obrigatória para novos usuários.");
        }

        validarConfirmacaoSenha(request.senha(), request.confirmacaoSenha());
        politicaSenhaService.validar(request.senha());
        validarEmailUnico(request.email(), null);

        SetorEntity setor = buscarSetor(request.setorId());
        PapelEntity papel = validarGovernancaDePapel(null, request.papel());
        PasswordHashService.PasswordHash senhaHash = passwordHashService.gerarHashSeguro(request.senha());

        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setNome(request.nome().trim());
        usuario.setEmail(normalizarEmail(request.email()));
        usuario.setLogin(normalizarEmail(request.email()));
        usuario.setSenhaHash(senhaHash.valor());
        usuario.setAlgoritmoHash(senhaHash.algoritmo());
        usuario.setExigeTrocaSenha(true);
        usuario.setPasswordResetRequestedAt(null);
        usuario.setSetor(setor);
        usuario.setAtivo(request.ativo() == null || request.ativo());
        aplicarEscopoFiliais(usuario, request);
        usuario = usuarioRepository.save(usuario);
        escopoFiliaisUsuarioStore.salvar(usuario);

        salvarPapelUnico(usuario, papel);
        salvarOverrides(usuario, request.permissoesNegadas(), request.permissoesConcedidas());

        auditService.registrar(AcaoAudit.USUARIO_CRIADO, usuario.getId(), usuario.getLogin(), "usuario", null);
        return mapearUsuario(usuario);
    }

    @Transactional
    public UsuarioAcessoDTO atualizarUsuario(Long usuarioId, UsuarioRequestDTO request) {
        Long usuarioIdNonNull = Objects.requireNonNull(usuarioId, "usuarioId é obrigatório.");

        UsuarioEntity usuario = usuarioRepository.findById(usuarioIdNonNull)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));

        validarImutabilidadeUsuarioSupremo(usuario);
        validarEmailUnico(request.email(), usuarioIdNonNull);

        SetorEntity setor = buscarSetor(request.setorId());
        String papelAtual = permissaoResolver.papel(usuarioIdNonNull);
        PapelEntity novoPapel = validarGovernancaDePapel(usuario, request.papel());
        boolean novoAtivo = request.ativo() == null || request.ativo();

        if (PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA.equals(papelAtual)
                && (!PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA.equals(novoPapel.getNome()) || !novoAtivo)
                && contarAdminsAtivos() <= 1) {
            throw new IllegalStateException("É obrigatório manter pelo menos um administrador ativo.");
        }

        usuario.setNome(request.nome().trim());
        usuario.setEmail(normalizarEmail(request.email()));
        usuario.setLogin(normalizarEmail(request.email()));
        usuario.setSetor(setor);
        usuario.setAtivo(novoAtivo);
        aplicarEscopoFiliais(usuario, request);

        boolean senhaAlterada = false;
        if (request.senha() != null && !request.senha().isBlank()) {
            validarConfirmacaoSenha(request.senha(), request.confirmacaoSenha());
            politicaSenhaService.validar(request.senha());
            PasswordHashService.PasswordHash senhaHash = passwordHashService.gerarHashSeguro(request.senha());
            usuario.setSenhaHash(senhaHash.valor());
            usuario.setAlgoritmoHash(senhaHash.algoritmo());
            usuario.setSenhaAlteradaEm(Instant.now());
            usuario.setExigeTrocaSenha(true);
            usuario.setPasswordResetRequestedAt(null);
            senhaAlterada = true;
        }

        usuario = usuarioRepository.save(usuario);
        escopoFiliaisUsuarioStore.salvar(usuario);

        boolean papelAlterado = !Objects.equals(papelAtual, novoPapel.getNome());
        if (papelAlterado) {
            salvarPapelUnico(usuario, novoPapel);
        }
        salvarOverrides(usuario, request.permissoesNegadas(), request.permissoesConcedidas());

        if (!novoAtivo || senhaAlterada) {
            refreshTokenService.revogarTodosDoUsuario(usuarioIdNonNull);
        }

        auditService.registrar(AcaoAudit.USUARIO_ATUALIZADO, usuario.getId(), usuario.getLogin(), "usuario", null);
        return mapearUsuario(usuario);
    }

    @Transactional
    public void inativarUsuario(Long usuarioId) {
        Long usuarioIdNonNull = Objects.requireNonNull(usuarioId, "usuarioId é obrigatório.");

        UsuarioEntity usuario = usuarioRepository.findById(usuarioIdNonNull)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));

        validarOperacaoContraUsuarioSupremo(usuario);
        validarGovernancaDePapel(usuario, permissaoResolver.papel(usuarioIdNonNull));

        if (PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA.equals(permissaoResolver.papel(usuarioIdNonNull))
                && contarAdminsAtivos() <= 1) {
            throw new IllegalStateException("É obrigatório manter pelo menos um administrador ativo.");
        }

        usuario.setAtivo(false);
        usuarioRepository.save(usuario);
        refreshTokenService.revogarTodosDoUsuario(usuarioIdNonNull);
        auditService.registrar(AcaoAudit.USUARIO_DESATIVADO, usuarioIdNonNull, usuario.getLogin(), "usuario", null);
    }

    @Transactional
    public void redefinirSenhaPorAdmin(Long usuarioId, String senhaTemporaria) {
        Long usuarioIdNonNull = Objects.requireNonNull(usuarioId, "usuarioId é obrigatório.");
        politicaSenhaService.validar(senhaTemporaria);
        UsuarioEntity usuario = usuarioRepository.findById(usuarioIdNonNull)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));

        validarImutabilidadeUsuarioSupremo(usuario);
        validarGovernancaDePapel(usuario, permissaoResolver.papel(usuarioIdNonNull));

        PasswordHashService.PasswordHash senhaHash = passwordHashService.gerarHashSeguro(senhaTemporaria);
        usuario.setSenhaHash(senhaHash.valor());
        usuario.setAlgoritmoHash(senhaHash.algoritmo());
        usuario.setSenhaAlteradaEm(Instant.now());
        usuario.setExigeTrocaSenha(true);
        usuario.setPasswordResetRequestedAt(null);
        usuario.setTentativasFalha(0);
        usuario.setBloqueadoAte(null);
        usuarioRepository.save(usuario);
        refreshTokenService.revogarTodosDoUsuario(usuarioIdNonNull);

        auditService.registrar(AcaoAudit.SENHA_REDEFINIDA_ADMIN, usuarioIdNonNull, usuario.getLogin(), "usuario", null);
    }

    @Transactional(readOnly = true)
    public List<PapelDTO> listarPapeisDisponiveis() {
        UsuarioEntity operador = usuarioAutenticado();
        Long operadorId = Objects.requireNonNull(operador.getId(), "usuario.id é obrigatório.");
        boolean papelElevado = permissaoResolver.ehAdminPlataforma(operadorId) || permissaoResolver.ehDesenvolvedor(operadorId);

        if (papelElevado) {
            return papelRepository.findDtosAtivosExceto(usuarioSupremo.papel());
        }
        return papelRepository.findDtosAtivosPorNomeExceto(
                PermissaoResolverService.PAPEL_USUARIO_COMUM,
                usuarioSupremo.papel()
        );
    }

    private UsuarioAcessoDTO mapearUsuarioResumo(
            UsuarioRepository.UsuarioAcessoResumoProjection usuario,
            List<PermissaoRepository.PermissaoResumoProjection> catalogoPermissoes,
            Map<Long, String> papeisPorUsuario,
            Map<Long, List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection>> overridesPorUsuario,
            Map<Long, Set<Long>> templatesPorSetor,
            Map<Long, List<String>> filiaisPorSetor,
            Map<Long, EscopoFiliaisUsuarioStore.EscopoUsuario> escoposPorUsuario,
            boolean exibirSolicitacaoRedefinicao
    ) {
        Long usuarioId = Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório.");
        Long setorId = Objects.requireNonNull(usuario.getSetorId(), "usuario.setorId é obrigatório.");
        String papel = papeisPorUsuario.getOrDefault(usuarioId, PermissaoResolverService.PAPEL_USUARIO_COMUM);
        List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection> overrides =
                overridesPorUsuario.getOrDefault(usuarioId, List.of());
        EscopoFiliaisUsuarioStore.EscopoUsuario escopo =
                escoposPorUsuario.getOrDefault(usuarioId, EscopoFiliaisUsuarioStore.EscopoUsuario.herdarSetor());
        String escopoFiliaisTipo = EscopoFiliaisUsuarioPolicy.normalizarTipo(escopo.tipo());
        List<String> filiaisPermitidasUsuario = ordenarFiliais(escopo.filiais());
        boolean acessoTotalFiliais = papelElevado(papel) || EscopoFiliaisUsuarioPolicy.TODAS.equals(escopoFiliaisTipo);
        List<String> filiaisPermitidasEfetivas = acessoTotalFiliais
                ? List.of()
                : EscopoFiliaisUsuarioPolicy.SELECIONADAS.equals(escopoFiliaisTipo)
                        ? filiaisPermitidasUsuario
                        : ordenarFiliais(filiaisPorSetor.getOrDefault(setorId, List.of()));

        return new UsuarioAcessoDTO(
                String.valueOf(usuarioId),
                usuario.getNome(),
                usuario.getEmail(),
                Boolean.TRUE.equals(usuario.getAtivo()),
                String.valueOf(setorId),
                usuario.getSetorNome(),
                papel,
                permissoesEfetivas(
                        papel,
                        setorId,
                        catalogoPermissoes,
                        templatesPorSetor,
                        overrides
                ),
                escopoFiliaisTipo,
                filiaisPermitidasUsuario,
                filiaisPermitidasEfetivas,
                chavesOverridePorTipo(overrides, "DENY"),
                chavesOverridePorTipo(overrides, "GRANT"),
                passwordHashService.statusAdministrativo(usuario.getAlgoritmoHash()).valor(),
                passwordHashService.algoritmoExibicao(usuario.getAlgoritmoHash()),
                exibirSolicitacaoRedefinicao ? usuario.getPasswordResetRequestedAt() : null,
                Boolean.TRUE.equals(usuario.getOnline()),
                parseUltimaAtividade(usuario.getUltimaAtividade()),
                formatarRotaNegocio(usuario.getUltimaRotaAcessada())
        );
    }

    private Map<Long, String> listarPapeisPorUsuario(List<Long> usuarioIds) {
        Map<Long, String> resultado = new LinkedHashMap<>();
        if (usuarioIds.isEmpty()) {
            return resultado;
        }
        papelVinculoRepository.findPapeisPorUsuarios(usuarioIds)
                .forEach(papel -> resultado.putIfAbsent(papel.getUsuarioId(), papel.getPapelNome()));
        return resultado;
    }

    private Map<Long, List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection>> listarOverridesPorUsuario(
            List<Long> usuarioIds
    ) {
        Map<Long, List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection>> resultado = new LinkedHashMap<>();
        if (usuarioIds.isEmpty()) {
            return resultado;
        }
        overrideRepository.findOverridesPorUsuarios(usuarioIds)
                .forEach(override -> resultado
                        .computeIfAbsent(override.getUsuarioId(), ignored -> new ArrayList<>())
                        .add(override));
        return resultado;
    }

    private Map<Long, Set<Long>> listarTemplatesPorSetor(List<Long> setorIds) {
        Map<Long, Set<Long>> resultado = new LinkedHashMap<>();
        if (setorIds.isEmpty()) {
            return resultado;
        }
        templateRepository.findPermissoesPorSetores(setorIds)
                .forEach(template -> resultado
                        .computeIfAbsent(template.getSetorId(), ignored -> new LinkedHashSet<>())
                        .add(template.getPermissaoId()));
        return resultado;
    }

    private Map<Long, List<String>> listarFiliaisPorSetor(List<Long> setorIds) {
        Map<Long, List<String>> resultado = new LinkedHashMap<>();
        if (setorIds.isEmpty()) {
            return resultado;
        }
        setorRepository.findFiliaisPermitidasPorSetores(setorIds)
                .forEach(filial -> resultado
                        .computeIfAbsent(filial.getSetorId(), ignored -> new ArrayList<>())
                        .add(filial.getFilialNome()));
        return resultado;
    }

    private Map<String, Boolean> permissoesEfetivas(
            String papel,
            Long setorId,
            List<PermissaoRepository.PermissaoResumoProjection> catalogoPermissoes,
            Map<Long, Set<Long>> templatesPorSetor,
            List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection> overrides
    ) {
        Map<String, Boolean> resultado = new LinkedHashMap<>();
        if (papelElevado(papel)) {
            catalogoPermissoes.forEach(permissao -> resultado.put(permissao.getChave(), true));
            return resultado;
        }

        Set<Long> templates = templatesPorSetor.getOrDefault(setorId, Set.of());
        Set<Long> negadas = idsOverridePorTipo(overrides, "DENY");
        Set<Long> concedidas = idsOverridePorTipo(overrides, "GRANT");
        for (PermissaoRepository.PermissaoResumoProjection permissao : catalogoPermissoes) {
            Long permissaoId = permissao.getId();
            resultado.put(permissao.getChave(), (templates.contains(permissaoId) && !negadas.contains(permissaoId))
                    || concedidas.contains(permissaoId));
        }
        return resultado;
    }

    private Set<Long> idsOverridePorTipo(
            List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection> overrides,
            String tipo
    ) {
        Set<Long> ids = new LinkedHashSet<>();
        overrides.stream()
                .filter(override -> tipo.equals(override.getTipo()))
                .map(UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection::getPermissaoId)
                .filter(Objects::nonNull)
                .forEach(ids::add);
        return ids;
    }

    private List<String> chavesOverridePorTipo(
            List<UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection> overrides,
            String tipo
    ) {
        return overrides.stream()
                .filter(override -> tipo.equals(override.getTipo()))
                .map(UsuarioPermissaoOverrideRepository.UsuarioPermissaoOverrideProjection::getChave)
                .filter(chave -> chave != null && !chave.isBlank())
                .map(String::trim)
                .distinct()
                .sorted()
                .toList();
    }

    private List<String> ordenarFiliais(List<String> filiais) {
        return filiais.stream()
                .filter(filial -> filial != null && !filial.isBlank())
                .map(String::trim)
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private boolean papelElevado(String papel) {
        return PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA.equals(papel)
                || usuarioSupremo.papel().equals(papel);
    }

    private UsuarioAcessoDTO mapearUsuario(UsuarioEntity usuario) {
        Long usuarioId = Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório.");
        escopoFiliaisUsuarioStore.carregarNoUsuario(usuario);
        Map<String, Boolean> permissoesEfetivas = permissaoResolver.permissoesEfetivas(usuario);
        String papel = permissaoResolver.papel(usuarioId);
        List<UsuarioPermissaoOverride> todosOverrides = overrideRepository.findAllByUsuarioId(usuarioId);
        List<String> permissoesNegadas = todosOverrides.stream()
                .filter(override -> "DENY".equals(override.getTipo()))
                .map(override -> override.getPermissao().getChaveLegado() != null
                        ? override.getPermissao().getChaveLegado()
                        : override.getPermissao().getChave())
                .sorted()
                .toList();
        List<String> permissoesConcedidas = todosOverrides.stream()
                .filter(override -> "GRANT".equals(override.getTipo()))
                .map(override -> override.getPermissao().getChaveLegado() != null
                        ? override.getPermissao().getChaveLegado()
                        : override.getPermissao().getChave())
                .sorted()
                .toList();
        String escopoFiliaisTipo = EscopoFiliaisUsuarioPolicy.normalizarTipo(usuario.getEscopoFiliaisTipo());
        List<String> filiaisPermitidasUsuario = EscopoFiliaisUsuarioPolicy.listarFiliaisUsuario(usuario);
        EscopoFilialService.EscopoFilial escopoFilial = permissaoResolver.ehAdminPlataforma(usuarioId) || permissaoResolver.ehDesenvolvedor(usuarioId)
                ? EscopoFilialService.EscopoFilial.comAcessoTotal()
                : EscopoFiliaisUsuarioPolicy.resolverSemPapelElevado(usuario);

        return new UsuarioAcessoDTO(
                String.valueOf(usuario.getId()),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.isAtivo(),
                String.valueOf(usuario.getSetor().getId()),
                usuario.getSetor().getNome(),
                papel,
                permissoesEfetivas,
                escopoFiliaisTipo,
                filiaisPermitidasUsuario,
                escopoFilial.acessoTotal() ? List.of() : escopoFilial.filiaisOrdenadas(),
                permissoesNegadas,
                permissoesConcedidas,
                passwordHashService.statusAdministrativo(usuario).valor(),
                passwordHashService.algoritmoExibicao(usuario),
                null,
                false,
                usuario.getUltimaAtividade(),
                formatarRotaNegocio(usuario.getUltimaRotaAcessada())
        );
    }

    private long valorLong(Long valor) {
        return valor == null ? 0 : valor;
    }

    private OffsetDateTime parseUltimaAtividade(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }

        String normalizado = valor.trim();
        try {
            return OffsetDateTime.parse(normalizado);
        } catch (DateTimeParseException ex) {
            try {
                return OffsetDateTime.parse(normalizado.replace(' ', 'T'));
            } catch (DateTimeParseException ignored) {
                return null;
            }
        }
    }

    private String formatarRotaNegocio(String rota) {
        if (rota == null || rota.isBlank()) {
            return null;
        }

        String normalizada = rota.trim();
        int queryIndex = normalizada.indexOf('?');
        if (queryIndex >= 0) {
            normalizada = normalizada.substring(0, queryIndex);
        }

        if (normalizada.equals("/")) {
            return "Início";
        }
        if (normalizada.startsWith("/admin/usuarios") || normalizada.startsWith("/api/admin/acesso/usuarios")) {
            return "Administração: Usuários";
        }
        if (normalizada.startsWith("/api/auth/")) {
            return "Sessão";
        }

        String segmento = normalizada;
        if (segmento.startsWith("/api/painel/")) {
            segmento = segmento.substring("/api/painel/".length());
        } else if (segmento.startsWith("/api/")) {
            segmento = segmento.substring("/api/".length());
        } else if (segmento.startsWith("/")) {
            segmento = segmento.substring(1);
        }

        int barraIndex = segmento.indexOf('/');
        if (barraIndex >= 0) {
            segmento = segmento.substring(0, barraIndex);
        }

        return switch (segmento) {
            case "coletas" -> "Coletas";
            case "manifestos" -> "Manifestos";
            case "fretes" -> "Faturamento/Fretes";
            case "tracking" -> "Tracking";
            case "performance" -> "Performance";
            case "faturas-por-cliente" -> "Faturas por Cliente";
            case "contas-a-pagar" -> "Contas a Pagar";
            case "cotacoes" -> "Cotações";
            case "indicadores-gestao-a-vista", "gestao-vista" -> "Indicadores de Gestão à Vista";
            case "executivo" -> "Executivo";
            case "etl-saude" -> "Saúde do ETL";
            case "integracoes" -> "Integrações";
            case "dimensoes" -> "Dimensões";
            case "admin" -> "Administração";
            default -> normalizada;
        };
    }

    private void aplicarEscopoFiliais(UsuarioEntity usuario, UsuarioRequestDTO request) {
        String tipo = EscopoFiliaisUsuarioPolicy.normalizarTipo(request.escopoFiliaisTipo());
        usuario.setEscopoFiliaisTipo(tipo);
        usuario.setFiliaisPermitidasUsuario(
                EscopoFiliaisUsuarioPolicy.normalizarFiliaisSelecionadas(tipo, request.filiaisPermitidasUsuario())
        );
    }

    private SetorEntity buscarSetor(String setorId) {
        try {
            Long id = Objects.requireNonNull(Long.valueOf(setorId), "setorId é obrigatório.");
            return setorRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Setor não encontrado."));
        } catch (NumberFormatException ex) {
            return setorRepository.findByChave(setorId)
                    .orElseThrow(() -> new IllegalArgumentException("Setor não encontrado."));
        }
    }

    private PapelEntity validarGovernancaDePapel(UsuarioEntity alvoExistente, String nomePapelSolicitado) {
        UsuarioEntity operador = usuarioAutenticado();
        Long operadorId = Objects.requireNonNull(operador.getId(), "usuario.id é obrigatório.");
        boolean operadorPapelElevado = permissaoResolver.ehAdminPlataforma(operadorId)
                || permissaoResolver.ehDesenvolvedor(operadorId);

        String papelAlvoAtual = alvoExistente != null && alvoExistente.getId() != null
                ? permissaoResolver.papel(alvoExistente.getId())
                : null;

        boolean solicitouPapelSupremo = usuarioSupremo.papel().equals(nomePapelSolicitado);
        if (solicitouPapelSupremo && !usuarioSupremo.ehUsuarioSupremo(alvoExistente)) {
            throw new AccessDeniedException("O papel desenvolvedor é exclusivo do usuário supremo.");
        }

        if (!operadorPapelElevado) {
            if (papelAlvoAtual != null && !PermissaoResolverService.PAPEL_USUARIO_COMUM.equals(papelAlvoAtual)) {
                throw new AccessDeniedException("Admin de acesso só pode operar usuários comuns.");
            }
            if (!PermissaoResolverService.PAPEL_USUARIO_COMUM.equals(nomePapelSolicitado)) {
                throw new AccessDeniedException("Admin de acesso só pode atribuir o papel usuario_comum.");
            }
        }

        return papelRepository.findByNome(nomePapelSolicitado)
                .orElseThrow(() -> new IllegalArgumentException("Papel inválido: " + nomePapelSolicitado));
    }

    private void salvarPapelUnico(UsuarioEntity usuario, PapelEntity papel) {
        Long usuarioId = Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório.");
        papelVinculoRepository.deleteAllByUsuarioId(usuarioId);

        UsuarioPapelVinculo vinculo = new UsuarioPapelVinculo();
        vinculo.setUsuario(usuario);
        vinculo.setPapel(papel);
        papelVinculoRepository.save(vinculo);
    }

    private void salvarOverrides(UsuarioEntity usuario, List<String> permissoesNegadas, List<String> permissoesConcedidas) {
        Long usuarioId = Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório.");
        List<String> negadas = normalizarPermissoes(permissoesNegadas);
        List<String> concedidas = normalizarPermissoes(permissoesConcedidas);

        Set<String> conflitantes = new LinkedHashSet<>(negadas);
        conflitantes.retainAll(concedidas);
        if (!conflitantes.isEmpty()) {
            throw new IllegalArgumentException("A mesma permissão não pode ser negada e concedida ao mesmo tempo: " + String.join(", ", conflitantes));
        }

        overrideRepository.deleteAllByUsuarioId(usuarioId);
        overrideRepository.flush();

        for (String chave : negadas) {
            PermissaoEntity permissao = permissaoRepository.findByChaveLegado(chave)
                    .orElseThrow(() -> new IllegalArgumentException("Permissão não encontrada: " + chave));
            UsuarioPermissaoOverride override = new UsuarioPermissaoOverride();
            override.setUsuario(usuario);
            override.setPermissao(permissao);
            override.setTipo("DENY");
            overrideRepository.save(override);
        }

        for (String chave : concedidas) {
            PermissaoEntity permissao = permissaoRepository.findByChaveLegado(chave)
                    .orElseThrow(() -> new IllegalArgumentException("Permissão não encontrada: " + chave));
            UsuarioPermissaoOverride override = new UsuarioPermissaoOverride();
            override.setUsuario(usuario);
            override.setPermissao(permissao);
            override.setTipo("GRANT");
            overrideRepository.save(override);
        }
    }

    private List<String> normalizarPermissoes(List<String> permissoes) {
        return permissoes == null ? List.of() : permissoes.stream()
                .filter(chave -> chave != null && !chave.isBlank())
                .map(String::trim)
                .distinct()
                .sorted()
                .toList();
    }

    private void validarEmailUnico(String email, Long excludeId) {
        String emailNormalizado = normalizarEmail(email);
        if (excludeId == null) {
            if (usuarioRepository.existsByEmailIgnoreCase(emailNormalizado)
                    || usuarioRepository.existsByLoginIgnoreCase(emailNormalizado)) {
                throw new IllegalStateException("Já existe um usuário com este e-mail.");
            }
            return;
        }

        Long excludeIdNonNull = Objects.requireNonNull(excludeId, "excludeId é obrigatório.");
        if (usuarioRepository.existsByEmailIgnoreCaseAndIdNot(emailNormalizado, excludeIdNonNull)
                || usuarioRepository.existsByLoginIgnoreCaseAndIdNot(emailNormalizado, excludeIdNonNull)) {
            throw new IllegalStateException("Já existe um usuário com este e-mail.");
        }
    }

    private void validarConfirmacaoSenha(String senha, String confirmacaoSenha) {
        if (!Objects.equals(senha, confirmacaoSenha)) {
            throw new IllegalArgumentException("A confirmação de senha não confere.");
        }
    }

    private void validarImutabilidadeUsuarioSupremo(UsuarioEntity usuario) {
        if (usuarioSupremo.ehUsuarioSupremo(usuario)) {
            throw new AccessDeniedException("Usuário supremo é imutável.");
        }
    }

    private void validarOperacaoContraUsuarioSupremo(UsuarioEntity usuario) {
        if (usuarioSupremo.ehUsuarioSupremo(usuario)) {
            throw new AccessDeniedException("Usuário supremo não pode ser excluído nem inativado.");
        }
    }

    private long contarAdminsAtivos() {
        return usuarioRepository.countAdminsAtivosPorPapeis(List.of(
                PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA,
                usuarioSupremo.papel()
        ));
    }

    private UsuarioEntity usuarioAutenticado() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Usuário autenticado não encontrado.");
        }

        return usuarioRepository.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException("Usuário autenticado não encontrado."));
    }

    private boolean operadorEhUsuarioSupremo() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.getName() != null
                && !authentication.getName().isBlank()
                && usuarioSupremo.ehEmailSupremo(authentication.getName());
    }

    private String normalizarEmail(String email) {
        return Objects.requireNonNull(email, "email é obrigatório.").trim().toLowerCase();
    }

}
