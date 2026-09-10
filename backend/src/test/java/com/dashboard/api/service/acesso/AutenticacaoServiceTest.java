package com.dashboard.api.service.acesso;

import com.dashboard.api.exception.CredencialInvalidaException;
import com.dashboard.api.model.acesso.AcaoAudit;
import com.dashboard.api.model.acesso.AuditLog;
import com.dashboard.api.model.acesso.SetorEntity;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.repository.acesso.AuditLogRepository;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.repository.acesso.RefreshTokenSessionRepository;
import com.dashboard.api.repository.acesso.SetorPermissaoTemplateRepository;
import com.dashboard.api.repository.acesso.UsuarioPapelVinculoRepository;
import com.dashboard.api.repository.acesso.UsuarioPermissaoOverrideRepository;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import com.dashboard.api.security.GerenciadorTokenJwt;
import com.dashboard.api.security.IpClienteResolver;
import java.util.concurrent.atomic.AtomicReference;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.lang.NonNull;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutenticacaoServiceTest {

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private RefreshTokenSessionRepository refreshTokenSessionRepository;

    private AutenticacaoService service;
    private StubPermissaoResolverService permissaoResolverService;

    @BeforeEach
    void setUp() {
        PasswordHashService passwordHashService = new PasswordHashService(
                Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8(),
                new BCryptPasswordEncoder()
        );
        AuditService auditService = new AuditService(auditLogRepository, new IpClienteResolver(false));
        RefreshTokenService refreshTokenService = new RefreshTokenService(refreshTokenSessionRepository, 24);
        permissaoResolverService = new StubPermissaoResolverService();

        service = new AutenticacaoService(
                usuarioRepository,
                passwordHashService,
                new GerenciadorTokenJwt("12345678901234567890123456789012", 15),
                permissaoResolverService,
                auditService,
                new PoliticaSenhaService(),
                refreshTokenService
        );
    }

    @Test
    void autenticarDeveMigrarHashBcryptValidoParaArgon2idNoMesmoLogin() {
        BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();
        UsuarioEntity usuario = criarUsuarioBase();
        usuario.setSenhaHash(bcrypt.encode("Senha@123456"));
        usuario.setAlgoritmoHash(PasswordHashService.ALGORITMO_BCRYPT);

        when(usuarioRepository.findByEmailIgnoreCase("maria@empresa.com")).thenReturn(Optional.of(usuario));
        when(usuarioRepository.save(anyNonNull(UsuarioEntity.class))).thenReturn(usuario);
        permissaoResolverService.permissoes = Map.of("coletas", true);
        permissaoResolverService.papel = PermissaoResolverService.PAPEL_USUARIO_COMUM;
        permissaoResolverService.adminPlataforma = false;

        var resposta = service.autenticar("maria@empresa.com", "Senha@123456");

        verify(usuarioRepository).save(anyNonNull(UsuarioEntity.class));

        assertThat(resposta.token()).isNotBlank();
        assertThat(usuario.getAlgoritmoHash()).isEqualTo(PasswordHashService.ALGORITMO_ARGON2ID);
        assertThat(usuario.getSenhaHash()).startsWith("$argon2id");
        assertThat(usuario.getSenhaAlteradaEm()).isNull();
    }

    @Test
    void autenticarDeveBloquearHashLegadoEAuditarMotivoDeResetObrigatorio() {
        UsuarioEntity usuario = criarUsuarioBase();
        usuario.setSenhaHash("5e884898da28047151d0e56f8dc62927");
        usuario.setAlgoritmoHash(PasswordHashService.ALGORITMO_MD5);

        when(usuarioRepository.findByEmailIgnoreCase("maria@empresa.com")).thenReturn(Optional.of(usuario));
        AtomicReference<AuditLog> auditLogSalvo = new AtomicReference<>();
        when(auditLogRepository.save(anyNonNull(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog auditLog = Objects.requireNonNull(invocation.getArgument(0, AuditLog.class));
            auditLogSalvo.set(auditLog);
            return auditLog;
        });

        assertThatThrownBy(() -> service.autenticar("maria@empresa.com", "password"))
                .isInstanceOf(CredencialInvalidaException.class)
                .hasMessage("Usuário ou senha inválidos.");

        AuditLog auditLog = Objects.requireNonNull(auditLogSalvo.get());
        assertThat(auditLog.getAcao()).isEqualTo(AcaoAudit.LOGIN_FALHA.name());
        assertThat(auditLog.getDetalhesJson()).contains("hash_legado_reset_obrigatorio");
    }

    @Test
    void gerarSessaoParaUsuarioPorEmailDeveRecarregarUsuarioGerenciado() {
        UsuarioEntity usuario = criarUsuarioBase();
        when(usuarioRepository.findByEmailIgnoreCase("maria@empresa.com")).thenReturn(Optional.of(usuario));
        permissaoResolverService.permissoes = Map.of("coletas", true);
        permissaoResolverService.papel = PermissaoResolverService.PAPEL_USUARIO_COMUM;

        var resposta = service.gerarSessaoParaUsuario("maria@empresa.com", java.time.Instant.now().plusSeconds(3600));

        verify(usuarioRepository).findByEmailIgnoreCase("maria@empresa.com");
        assertThat(resposta.usuario().email()).isEqualTo("maria@empresa.com");
        assertThat(resposta.token()).isNotBlank();
        assertThat(resposta.sessaoExpiraEm()).isNotNull();
    }

    @Test
    void gerarSessaoParaUsuarioComEntidadeDesanexadaDeveRecarregarSetor() {
        UsuarioEntity usuarioDesanexado = new UsuarioEntity();
        usuarioDesanexado.setId(10L);
        usuarioDesanexado.setEmail("maria@empresa.com");

        UsuarioEntity usuarioCarregado = criarUsuarioBase();
        when(usuarioRepository.findByEmailIgnoreCase("maria@empresa.com")).thenReturn(Optional.of(usuarioCarregado));
        permissaoResolverService.permissoes = Map.of("coletas", true);
        permissaoResolverService.papel = PermissaoResolverService.PAPEL_USUARIO_COMUM;

        var resposta = service.gerarSessaoParaUsuario(usuarioDesanexado);

        verify(usuarioRepository).findByEmailIgnoreCase("maria@empresa.com");
        assertThat(resposta.usuario().setor().nome()).isEqualTo("Logística");
    }

    @Test
    void concluirTrocaObrigatoriaDeveGerarArgon2idELiberarUsuario() {
        Argon2PasswordEncoder argon2 = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
        UsuarioEntity usuario = criarUsuarioBase();
        String senhaTemporaria = senhaTemporariaTeste();
        usuario.setSenhaHash(argon2.encode(senhaTemporaria));
        usuario.setAlgoritmoHash(PasswordHashService.ALGORITMO_ARGON2ID);
        usuario.setExigeTrocaSenha(true);

        when(usuarioRepository.findByEmailIgnoreCase("maria@empresa.com")).thenReturn(Optional.of(usuario));
        when(usuarioRepository.save(anyNonNull(UsuarioEntity.class))).thenReturn(usuario);

        UsuarioEntity atualizado = service.concluirTrocaSenhaObrigatoria(
                "maria@empresa.com",
                senhaTemporaria,
                "NovaSenha@2026"
        );

        assertThat(atualizado.isExigeTrocaSenha()).isFalse();
        assertThat(atualizado.getAlgoritmoHash()).isEqualTo(PasswordHashService.ALGORITMO_ARGON2ID);
        assertThat(argon2.matches("NovaSenha@2026", atualizado.getSenhaHash())).isTrue();
        verify(refreshTokenSessionRepository).findAllByUsuarioIdAndRevogadoEmIsNull(10L);
    }

    @Test
    void usuarioComTrocaObrigatoriaNaoRecebeAuthoritiesNemSessao() {
        UsuarioEntity usuario = criarUsuarioBase();
        usuario.setExigeTrocaSenha(true);
        when(usuarioRepository.findByEmailIgnoreCase("maria@empresa.com")).thenReturn(Optional.of(usuario));

        assertThat(service.authoritiesFor("maria@empresa.com")).isEmpty();
        assertThatThrownBy(() -> service.gerarSessaoParaUsuario(usuario))
                .isInstanceOf(CredencialInvalidaException.class)
                .hasMessage("É necessário definir uma nova senha antes de acessar a plataforma.");
    }

    private UsuarioEntity criarUsuarioBase() {
        SetorEntity setor = new SetorEntity();
        setor.setId(2L);
        setor.setNome("Logística");
        setor.setFiliaisPermitidas(java.util.Set.of("Matriz"));

        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(10L);
        usuario.setNome("Maria");
        usuario.setEmail("maria@empresa.com");
        usuario.setLogin("maria@empresa.com");
        usuario.setAtivo(true);
        usuario.setSetor(setor);
        usuario.setExigeTrocaSenha(false);
        return usuario;
    }

    private String senhaTemporariaTeste() {
        return "T3mp@" + UUID.randomUUID();
    }

    @NonNull
    private static <T> T anyNonNull(Class<T> type) {
        return any(type);
    }

    private static final class StubPermissaoResolverService extends PermissaoResolverService {
        private java.util.Map<String, Boolean> permissoes = Map.of();
        private String papel = PermissaoResolverService.PAPEL_USUARIO_COMUM;
        private boolean adminPlataforma;

        private StubPermissaoResolverService() {
            super(
                    org.mockito.Mockito.mock(PermissaoRepository.class),
                    org.mockito.Mockito.mock(SetorPermissaoTemplateRepository.class),
                    org.mockito.Mockito.mock(UsuarioPapelVinculoRepository.class),
                    org.mockito.Mockito.mock(UsuarioPermissaoOverrideRepository.class),
                    new UsuarioSupremo("supremo@empresa.com", "Senha@123456", "Supremo", "desenvolvedor", 1000, false)
            );
        }

        @Override
        public Map<String, Boolean> permissoesEfetivas(UsuarioEntity usuario) {
            return permissoes;
        }

        @Override
        public com.dashboard.api.dto.acesso.AcessoResolvidoDTO resolverAcesso(UsuarioEntity usuario) {
            return new com.dashboard.api.dto.acesso.AcessoResolvidoDTO(papel, ehAdmin(usuario.getId()), adminPlataforma, permissoes);
        }

        @Override
        public String papel(Long usuarioId) {
            return papel;
        }

        @Override
        public boolean ehAdminPlataforma(Long usuarioId) {
            return adminPlataforma;
        }
    }
}
