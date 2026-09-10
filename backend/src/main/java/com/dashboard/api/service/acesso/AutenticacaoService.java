package com.dashboard.api.service.acesso;

import com.dashboard.api.dto.LoginResponseDTO;
import com.dashboard.api.dto.SessaoUsuarioDTO;
import com.dashboard.api.dto.SetorSessaoDTO;
import com.dashboard.api.exception.CredencialInvalidaException;
import com.dashboard.api.model.acesso.AcaoAudit;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.policy.EscopoFiliaisUsuarioPolicy;
import com.dashboard.api.repository.acesso.EscopoFiliaisUsuarioStore;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.security.GerenciadorTokenJwt;
import com.dashboard.api.security.PermissaoCatalogo;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AutenticacaoService {

    private static final Logger log = LoggerFactory.getLogger(AutenticacaoService.class);
    private static final int MAX_TENTATIVAS = 5;
    private static final int LOCKOUT_MINUTOS = 15;

    private final UsuarioRepository usuarioRepository;
    private final PasswordHashService passwordHashService;
    private final GerenciadorTokenJwt gerenciadorToken;
    private final PermissaoResolverService permissaoResolver;
    private final AuditService auditService;
    private final PoliticaSenhaService politicaSenhaService;
    private final RefreshTokenService refreshTokenService;
    private final EscopoFiliaisUsuarioStore escopoFiliaisUsuarioStore;

    @Autowired
    public AutenticacaoService(
            UsuarioRepository usuarioRepository,
            PasswordHashService passwordHashService,
            GerenciadorTokenJwt gerenciadorToken,
            PermissaoResolverService permissaoResolver,
            AuditService auditService,
            PoliticaSenhaService politicaSenhaService,
            RefreshTokenService refreshTokenService,
            EscopoFiliaisUsuarioStore escopoFiliaisUsuarioStore
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordHashService = passwordHashService;
        this.gerenciadorToken = gerenciadorToken;
        this.permissaoResolver = permissaoResolver;
        this.auditService = auditService;
        this.politicaSenhaService = politicaSenhaService;
        this.refreshTokenService = refreshTokenService;
        this.escopoFiliaisUsuarioStore = escopoFiliaisUsuarioStore;
    }

    public AutenticacaoService(
            UsuarioRepository usuarioRepository,
            PasswordHashService passwordHashService,
            GerenciadorTokenJwt gerenciadorToken,
            PermissaoResolverService permissaoResolver,
            AuditService auditService,
            PoliticaSenhaService politicaSenhaService,
            RefreshTokenService refreshTokenService
    ) {
        this(
                usuarioRepository,
                passwordHashService,
                gerenciadorToken,
                permissaoResolver,
                auditService,
                politicaSenhaService,
                refreshTokenService,
                null
        );
    }

    @Transactional
    public LoginResponseDTO autenticar(String email, String senha) {
        UsuarioEntity usuario = autenticarCredenciais(email, senha);
        if (usuario.isExigeTrocaSenha()) {
            registrarTrocaSenhaObrigatoriaIniciada(usuario);
            throw new CredencialInvalidaException("É necessário definir uma nova senha antes de acessar a plataforma.");
        }

        registrarLoginRealizado(usuario);
        return gerarSessaoParaUsuario(usuario);
    }

    @Transactional
    public UsuarioEntity autenticarCredenciais(String email, String senha) {
        UsuarioEntity usuario = usuarioRepository.findByEmailIgnoreCase(email.trim()).orElse(null);

        if (usuario == null || !usuario.isAtivo()) {
            auditService.registrarSync(AcaoAudit.LOGIN_FALHA, null, email, "auth", null);
            throw new CredencialInvalidaException("Usuário ou senha inválidos.");
        }

        if (usuario.getBloqueadoAte() != null && Instant.now().isBefore(usuario.getBloqueadoAte())) {
            auditService.registrarSync(AcaoAudit.LOGIN_FALHA, usuario.getId(), usuario.getLogin(), "auth", "{\"motivo\":\"conta_bloqueada\"}");
            throw new CredencialInvalidaException("Conta temporariamente bloqueada. Tente novamente mais tarde.");
        }

        PasswordHashService.PasswordVerification verificacao = passwordHashService.verificarSenha(usuario, senha);
        if (verificacao.resetObrigatorio()) {
            auditService.registrarSync(
                    AcaoAudit.LOGIN_FALHA,
                    usuario.getId(),
                    usuario.getLogin(),
                    "auth",
                    "{\"motivo\":\"hash_legado_reset_obrigatorio\",\"algoritmo\":\"" + verificacao.algoritmoAtual() + "\"}"
            );
            throw new CredencialInvalidaException("Usuário ou senha inválidos.");
        }

        if (!verificacao.valida()) {
            usuario.setTentativasFalha(usuario.getTentativasFalha() + 1);
            if (usuario.getTentativasFalha() >= MAX_TENTATIVAS) {
                usuario.setBloqueadoAte(Instant.now().plus(LOCKOUT_MINUTOS, ChronoUnit.MINUTES));
                auditService.registrarSync(AcaoAudit.CONTA_BLOQUEADA, usuario.getId(), usuario.getLogin(), "auth",
                        "{\"tentativas\":" + usuario.getTentativasFalha() + "}");
                log.warn("Conta bloqueada por excesso de tentativas: {}", usuario.getLogin());
            }
            usuarioRepository.save(usuario);
            auditService.registrarSync(AcaoAudit.LOGIN_FALHA, usuario.getId(), usuario.getLogin(), "auth", null);
            throw new CredencialInvalidaException("Usuário ou senha inválidos.");
        }

        usuario.setTentativasFalha(0);
        usuario.setBloqueadoAte(null);
        if (verificacao.precisaUpgrade()) {
            PasswordHashService.PasswordHash senhaRehash = passwordHashService.gerarHashSeguro(senha);
            usuario.setSenhaHash(senhaRehash.valor());
            usuario.setAlgoritmoHash(senhaRehash.algoritmo());
        }
        usuarioRepository.save(usuario);
        return usuario;
    }

    @Transactional
    public UsuarioEntity concluirTrocaSenhaObrigatoria(String email, String senhaTemporaria, String novaSenha) {
        UsuarioEntity usuario = autenticarCredenciais(email, senhaTemporaria);
        if (!usuario.isExigeTrocaSenha()) {
            throw new CredencialInvalidaException("Usuário ou senha inválidos.");
        }

        if (Objects.equals(senhaTemporaria, novaSenha)) {
            throw new IllegalArgumentException("A nova senha deve ser diferente da senha temporária.");
        }

        politicaSenhaService.validar(novaSenha);
        PasswordHashService.PasswordHash senhaHash = passwordHashService.gerarHashSeguro(novaSenha);
        usuario.setSenhaHash(senhaHash.valor());
        usuario.setAlgoritmoHash(senhaHash.algoritmo());
        usuario.setSenhaAlteradaEm(Instant.now());
        usuario.setExigeTrocaSenha(false);
        usuarioRepository.save(usuario);
        refreshTokenService.revogarTodosDoUsuario(Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório."));

        auditService.registrar(AcaoAudit.SENHA_ALTERADA, usuario.getId(), usuario.getLogin(), "auth", "{\"origem\":\"troca_obrigatoria\"}");
        return usuario;
    }

    @Transactional
    public void alterarSenha(String email, String senhaAtual, String novaSenha) {
        UsuarioEntity usuario = carregarUsuarioAtivoPorEmail(email);
        PasswordHashService.PasswordVerification verificacaoSenhaAtual = passwordHashService.verificarSenha(usuario, senhaAtual);

        if (!verificacaoSenhaAtual.valida()) {
            throw new IllegalArgumentException("Senha atual incorreta.");
        }

        politicaSenhaService.validar(novaSenha);
        PasswordHashService.PasswordHash senhaHash = passwordHashService.gerarHashSeguro(novaSenha);
        usuario.setSenhaHash(senhaHash.valor());
        usuario.setAlgoritmoHash(senhaHash.algoritmo());
        usuario.setSenhaAlteradaEm(Instant.now());
        usuario.setExigeTrocaSenha(false);
        usuarioRepository.save(usuario);
        refreshTokenService.revogarTodosDoUsuario(Objects.requireNonNull(usuario.getId(), "usuario.id é obrigatório."));

        auditService.registrar(AcaoAudit.SENHA_ALTERADA, usuario.getId(), usuario.getLogin(), "auth", null);
    }

    @Transactional(readOnly = true)
    public SessaoUsuarioDTO buscarSessaoAtual(String email) {
        return mapearSessao(carregarUsuarioAtivoPorEmail(email));
    }

    @Transactional(readOnly = true)
    public List<SimpleGrantedAuthority> authoritiesFor(String email) {
        UsuarioEntity usuario = usuarioRepository.findByEmailIgnoreCase(email).orElse(null);
        if (usuario == null || !usuario.isAtivo() || usuario.isExigeTrocaSenha()) {
            return List.of();
        }

        var acesso = permissaoResolver.resolverAcesso(usuario);

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority(acesso.administrador() ? "ROLE_ADMIN" : "ROLE_USER"));
        authorities.add(new SimpleGrantedAuthority("ROLE_" + acesso.papel().toUpperCase(java.util.Locale.ROOT)));

        acesso.permissoes().entrySet().stream()
                .filter(Map.Entry::getValue)
                .map(entry -> PermissaoCatalogo.authorityForKey(entry.getKey()))
                .map(SimpleGrantedAuthority::new)
                .forEach(authorities::add);

        return authorities;
    }

    @Transactional(readOnly = true)
    public UsuarioEntity carregarUsuarioAtivoPorEmail(String email) {
        UsuarioEntity usuario = usuarioRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuário autenticado não encontrado."));

        if (!usuario.isAtivo()) {
            throw new IllegalArgumentException("Usuário autenticado não encontrado.");
        }

        return usuario;
    }

    @Transactional(readOnly = true)
    public LoginResponseDTO gerarSessaoParaUsuario(UsuarioEntity usuario) {
        return gerarSessaoParaUsuarioAtual(usuario.getEmail(), null);
    }

    @Transactional(readOnly = true)
    public LoginResponseDTO gerarSessaoParaUsuario(String email, Instant sessaoExpiraEm) {
        return gerarSessaoParaUsuarioAtual(email, sessaoExpiraEm);
    }

    @Transactional(readOnly = true)
    public LoginResponseDTO gerarSessaoParaUsuario(UsuarioEntity usuario, Instant sessaoExpiraEm) {
        return gerarSessaoParaUsuarioAtual(usuario.getEmail(), sessaoExpiraEm);
    }

    private LoginResponseDTO gerarSessaoParaUsuarioAtual(String email, Instant sessaoExpiraEm) {
        return gerarSessaoParaUsuarioCarregado(carregarUsuarioAtivoPorEmail(email), sessaoExpiraEm);
    }

    private LoginResponseDTO gerarSessaoParaUsuarioCarregado(UsuarioEntity usuario, Instant sessaoExpiraEm) {
        if (usuario.isExigeTrocaSenha()) {
            throw new CredencialInvalidaException("É necessário definir uma nova senha antes de acessar a plataforma.");
        }

        return new LoginResponseDTO(
                mapearSessao(usuario),
                gerenciadorToken.gerarToken(usuario.getEmail()),
                usuario.isExigeTrocaSenha(),
                sessaoExpiraEm
        );
    }

    public void registrarLoginRealizado(UsuarioEntity usuario) {
        auditService.registrar(AcaoAudit.LOGIN, usuario.getId(), usuario.getLogin(), "auth", null);
    }

    public void registrarTrocaSenhaObrigatoriaIniciada(UsuarioEntity usuario) {
        auditService.registrar(
                AcaoAudit.TROCA_SENHA_OBRIGATORIA_INICIADA,
                usuario.getId(),
                usuario.getLogin(),
                "auth",
                null
        );
    }

    @Transactional
    public void solicitarRedefinicaoSenha(String email) {
        usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(email.trim()).ifPresent(usuario -> {
            usuario.setPasswordResetRequestedAt(Instant.now());
            usuarioRepository.save(usuario);
            auditService.registrar(
                    AcaoAudit.SENHA_REDEFINICAO_SOLICITADA,
                    usuario.getId(),
                    usuario.getLogin(),
                    "auth",
                    null
            );
        });
    }

    private SessaoUsuarioDTO mapearSessao(UsuarioEntity usuario) {
        if (escopoFiliaisUsuarioStore != null) {
            escopoFiliaisUsuarioStore.carregarNoUsuario(usuario);
        }
        var acesso = permissaoResolver.resolverAcesso(usuario);
        EscopoFilialService.EscopoFilial escopoFilial = acesso.escopoFilialTotal()
                ? EscopoFilialService.EscopoFilial.comAcessoTotal()
                : EscopoFiliaisUsuarioPolicy.resolverSemPapelElevado(usuario);

        return new SessaoUsuarioDTO(
                String.valueOf(usuario.getId()),
                usuario.getNome(),
                usuario.getEmail(),
                acesso.papel(),
                new SetorSessaoDTO(String.valueOf(usuario.getSetor().getId()), usuario.getSetor().getNome()),
                acesso.permissoes(),
                escopoFilial.acessoTotal() ? List.of() : escopoFilial.filiaisOrdenadas(),
                usuario.isExigeTrocaSenha()
        );
    }
}
