package com.dashboard.api.service.acesso;

import com.dashboard.api.dto.acesso.UsuarioRequestDTO;
import com.dashboard.api.model.acesso.PapelEntity;
import com.dashboard.api.model.acesso.PermissaoEntity;
import com.dashboard.api.model.acesso.SetorEntity;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.model.acesso.UsuarioPapelVinculo;
import com.dashboard.api.model.acesso.UsuarioPermissaoOverride;
import com.dashboard.api.policy.EscopoFiliaisUsuarioPolicy;
import com.dashboard.api.repository.acesso.AuditLogRepository;
import com.dashboard.api.repository.acesso.EscopoFiliaisUsuarioStore;
import com.dashboard.api.repository.acesso.PapelRepository;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.repository.acesso.RefreshTokenSessionRepository;
import com.dashboard.api.repository.acesso.SetorPermissaoTemplateRepository;
import com.dashboard.api.repository.acesso.SetorRepository;
import com.dashboard.api.repository.acesso.UsuarioPapelVinculoRepository;
import com.dashboard.api.repository.acesso.UsuarioPermissaoOverrideRepository;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.security.IpClienteResolver;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GestaoUsuarioServiceTest {

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private SetorRepository setorRepository;
    @Mock private PapelRepository papelRepository;
    @Mock private UsuarioPapelVinculoRepository papelVinculoRepository;
    @Mock private UsuarioPermissaoOverrideRepository overrideRepository;
    @Mock private PermissaoRepository permissaoRepository;
    @Mock private SetorPermissaoTemplateRepository templateRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private RefreshTokenSessionRepository refreshTokenSessionRepository;
    private GestaoUsuarioService service;
    private PermissaoResolverService permissaoResolver;
    private AuditService auditService;
    private PoliticaSenhaService politicaSenhaService;
    private RefreshTokenService refreshTokenService;
    private UsuarioSupremo usuarioSupremo;

    @BeforeEach
    void setUp() {
        usuarioSupremo = new UsuarioSupremo("supremo@empresa.com", "Senha@123456", "Supremo", "desenvolvedor", 1000, false);
        permissaoResolver = new PermissaoResolverService(
                permissaoRepository,
                templateRepository,
                papelVinculoRepository,
                overrideRepository,
                usuarioSupremo
        );
        auditService = new AuditService(auditLogRepository, new IpClienteResolver(false));
        politicaSenhaService = new PoliticaSenhaService();
        refreshTokenService = new RefreshTokenService(refreshTokenSessionRepository, 24);
        PasswordHashService passwordHashService = new PasswordHashService(
                Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8(),
                new BCryptPasswordEncoder()
        );

        service = new GestaoUsuarioService(
                usuarioRepository,
                setorRepository,
                papelRepository,
                papelVinculoRepository,
                overrideRepository,
                permissaoRepository,
                templateRepository,
                passwordHashService,
                permissaoResolver,
                auditService,
                politicaSenhaService,
                refreshTokenService,
                usuarioSupremo,
                new StubEscopoFiliaisUsuarioStore()
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deveRejeitarConfirmacaoSenhaDivergenteNaCriacao() {
        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Usuário Teste",
                "teste@empresa.com",
                "Senha@123456",
                "Senha@123457",
                "1",
                "usuario_comum",
                List.of(),
                List.of(),
                EscopoFiliaisUsuarioPolicy.HERDAR_SETOR,
                List.of(),
                true
        );

        assertThrows(IllegalArgumentException.class, () -> service.criarUsuario(request));
    }

    @Test
    void adminAcessoNaoPodeCriarAdminPlataforma() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("acesso@empresa.com", null, List.of())
        );

        UsuarioEntity operador = new UsuarioEntity();
        operador.setId(99L);
        operador.setEmail("acesso@empresa.com");
        operador.setAtivo(true);

        SetorEntity setor = new SetorEntity();
        setor.setId(1L);

        when(usuarioRepository.findByEmailIgnoreCase("acesso@empresa.com")).thenReturn(Optional.of(operador));
        when(usuarioRepository.existsByEmailIgnoreCase("novo@empresa.com")).thenReturn(false);
        when(usuarioRepository.existsByLoginIgnoreCase("novo@empresa.com")).thenReturn(false);
        when(setorRepository.findById(1L)).thenReturn(Optional.of(setor));

        PapelEntity papelAdminAcesso = new PapelEntity();
        papelAdminAcesso.setNome(PermissaoResolverService.PAPEL_ADMIN_ACESSO);
        papelAdminAcesso.setNivel(50);

        UsuarioPapelVinculo vinculo = new UsuarioPapelVinculo();
        vinculo.setPapel(papelAdminAcesso);
        when(papelVinculoRepository.findAllByUsuarioId(99L)).thenReturn(List.of(vinculo));

        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Novo Usuário",
                "novo@empresa.com",
                "Senha@123456",
                "Senha@123456",
                "1",
                "admin_plataforma",
                List.of(),
                List.of(),
                EscopoFiliaisUsuarioPolicy.HERDAR_SETOR,
                List.of(),
                true
        );

        assertThrows(AccessDeniedException.class, () -> service.criarUsuario(request));
    }

    @Test
    void atualizarUsuarioMantendoMesmoPapelNaoRecriaVinculoAoAlterarOverrides() {
        ContextoAtualizacao contexto = prepararContextoAtualizacao(PermissaoResolverService.PAPEL_USUARIO_COMUM);
        UsuarioEntity alvo = Objects.requireNonNull(contexto.alvo());
        SetorEntity setor = Objects.requireNonNull(contexto.setor());
        PapelEntity papelSolicitado = Objects.requireNonNull(contexto.papelSolicitado());

        PermissaoEntity permissaoColetas = criarPermissao(10L, "coletas");
        UsuarioPermissaoOverride denyColetas = criarOverride(alvo, permissaoColetas, "DENY");

        when(papelRepository.findByNome(PermissaoResolverService.PAPEL_USUARIO_COMUM))
                .thenReturn(Optional.of(papelSolicitado));
        when(permissaoRepository.findByChaveLegado("coletas")).thenReturn(Optional.of(permissaoColetas));
        when(permissaoRepository.findAllByAtivoTrue()).thenReturn(List.of(permissaoColetas));
        when(templateRepository.findAllBySetorId(setor.getId())).thenReturn(List.of());
        when(overrideRepository.findAllByUsuarioId(alvo.getId())).thenReturn(List.of(denyColetas));
        when(usuarioRepository.save(alvo)).thenReturn(alvo);
        clearInvocations(usuarioRepository);
        clearInvocations(papelVinculoRepository);
        clearInvocations(overrideRepository);

        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Usuário Teste Atualizado",
                "teste@empresa.com",
                null,
                null,
                "1",
                PermissaoResolverService.PAPEL_USUARIO_COMUM,
                List.of("coletas"),
                List.of(),
                EscopoFiliaisUsuarioPolicy.HERDAR_SETOR,
                List.of(),
                true
        );

        var resultado = service.atualizarUsuario(alvo.getId(), request);

        verify(papelVinculoRepository, never()).deleteAllByUsuarioId(alvo.getId());
        assertFalse(foiChamado(papelVinculoRepository, "save"));
        verify(overrideRepository).deleteAllByUsuarioId(alvo.getId());
        verify(overrideRepository).flush();
        assertSequenciaDeMetodos(overrideRepository, "deleteAllByUsuarioId", "flush", "save");
        UsuarioPermissaoOverride overrideSalvo = argumentoSalvo(overrideRepository, UsuarioPermissaoOverride.class);
        assertEquals("DENY", overrideSalvo.getTipo());
        assertSame(alvo, overrideSalvo.getUsuario());
        assertSame(permissaoColetas, overrideSalvo.getPermissao());
        assertEquals(List.of("coletas"), resultado.permissoesNegadas());
        assertEquals(PermissaoResolverService.PAPEL_USUARIO_COMUM, resultado.papel());
    }

    @Test
    void deveRemoverGrantDeCotacoesSemRecriarVinculoQuandoPapelNaoMuda() {
        ContextoAtualizacao contexto = prepararContextoAtualizacao(PermissaoResolverService.PAPEL_USUARIO_COMUM);
        UsuarioEntity alvo = Objects.requireNonNull(contexto.alvo());
        SetorEntity setor = Objects.requireNonNull(contexto.setor());
        PapelEntity papelSolicitado = Objects.requireNonNull(contexto.papelSolicitado());

        PermissaoEntity permissaoCotacoes = criarPermissao(11L, "cotacoes");

        when(papelRepository.findByNome(PermissaoResolverService.PAPEL_USUARIO_COMUM))
                .thenReturn(Optional.of(papelSolicitado));
        when(permissaoRepository.findAllByAtivoTrue()).thenReturn(List.of(permissaoCotacoes));
        when(templateRepository.findAllBySetorId(setor.getId())).thenReturn(List.of());
        when(overrideRepository.findAllByUsuarioId(alvo.getId())).thenReturn(List.of());
        when(usuarioRepository.save(alvo)).thenReturn(alvo);
        clearInvocations(usuarioRepository);
        clearInvocations(papelVinculoRepository);
        clearInvocations(overrideRepository);

        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Usuário Teste Atualizado",
                "teste@empresa.com",
                null,
                null,
                "1",
                PermissaoResolverService.PAPEL_USUARIO_COMUM,
                List.of(),
                List.of(),
                EscopoFiliaisUsuarioPolicy.HERDAR_SETOR,
                List.of(),
                true
        );

        var resultado = service.atualizarUsuario(alvo.getId(), request);

        verify(papelVinculoRepository, never()).deleteAllByUsuarioId(alvo.getId());
        assertFalse(foiChamado(papelVinculoRepository, "save"));
        verify(overrideRepository).deleteAllByUsuarioId(alvo.getId());
        verify(overrideRepository).flush();
        assertSequenciaDeMetodos(overrideRepository, "deleteAllByUsuarioId", "flush");
        assertFalse(foiChamado(overrideRepository, "save"));
        assertEquals(List.of(), resultado.permissoesConcedidas());
        assertEquals(PermissaoResolverService.PAPEL_USUARIO_COMUM, resultado.papel());
    }

    @Test
    void atualizarUsuarioComMudancaDePapelRecriaVinculo() {
        ContextoAtualizacao contexto = prepararContextoAtualizacao(PermissaoResolverService.PAPEL_ADMIN_ACESSO);
        UsuarioEntity alvo = Objects.requireNonNull(contexto.alvo());
        SetorEntity setor = Objects.requireNonNull(contexto.setor());
        PapelEntity papelSolicitado = Objects.requireNonNull(contexto.papelSolicitado());

        when(papelRepository.findByNome(PermissaoResolverService.PAPEL_ADMIN_ACESSO))
                .thenReturn(Optional.of(papelSolicitado));
        when(permissaoRepository.findAllByAtivoTrue()).thenReturn(List.of());
        when(templateRepository.findAllBySetorId(setor.getId())).thenReturn(List.of());
        when(overrideRepository.findAllByUsuarioId(alvo.getId())).thenReturn(List.of());
        when(usuarioRepository.save(alvo)).thenReturn(alvo);
        clearInvocations(usuarioRepository);
        clearInvocations(papelVinculoRepository);
        clearInvocations(overrideRepository);

        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Usuário Teste Atualizado",
                "teste@empresa.com",
                null,
                null,
                "1",
                PermissaoResolverService.PAPEL_ADMIN_ACESSO,
                List.of(),
                List.of(),
                EscopoFiliaisUsuarioPolicy.HERDAR_SETOR,
                List.of(),
                true
        );

        service.atualizarUsuario(alvo.getId(), request);

        verify(papelVinculoRepository).deleteAllByUsuarioId(alvo.getId());
        UsuarioPapelVinculo vinculoSalvo = argumentoSalvo(papelVinculoRepository, UsuarioPapelVinculo.class);
        assertSame(alvo, vinculoSalvo.getUsuario());
        assertSame(papelSolicitado, vinculoSalvo.getPapel());
    }

    @Test
    void deveRejeitarPermissaoConflitanteEntreNegadaEConcedida() {
        ContextoAtualizacao contexto = prepararContextoAtualizacao(PermissaoResolverService.PAPEL_USUARIO_COMUM);
        UsuarioEntity alvo = Objects.requireNonNull(contexto.alvo());
        PapelEntity papelSolicitado = Objects.requireNonNull(contexto.papelSolicitado());

        when(papelRepository.findByNome(PermissaoResolverService.PAPEL_USUARIO_COMUM))
                .thenReturn(Optional.of(papelSolicitado));
        when(usuarioRepository.save(alvo)).thenReturn(alvo);
        clearInvocations(usuarioRepository);
        clearInvocations(papelVinculoRepository);
        clearInvocations(overrideRepository);

        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Usuário Teste Atualizado",
                "teste@empresa.com",
                null,
                null,
                "1",
                PermissaoResolverService.PAPEL_USUARIO_COMUM,
                List.of("cotacoes"),
                List.of("cotacoes"),
                EscopoFiliaisUsuarioPolicy.HERDAR_SETOR,
                List.of(),
                true
        );

        assertThrows(IllegalArgumentException.class, () -> service.atualizarUsuario(alvo.getId(), request));

        assertFalse(foiChamado(overrideRepository, "deleteAllByUsuarioId"));
        assertFalse(foiChamado(overrideRepository, "flush"));
        assertFalse(foiChamado(overrideRepository, "save"));
    }

    @Test
    void deveRejeitarEscopoSelecionadasSemFiliais() {
        ContextoAtualizacao contexto = prepararContextoAtualizacao(PermissaoResolverService.PAPEL_USUARIO_COMUM);
        UsuarioEntity alvo = Objects.requireNonNull(contexto.alvo());
        PapelEntity papelSolicitado = Objects.requireNonNull(contexto.papelSolicitado());

        when(papelRepository.findByNome(PermissaoResolverService.PAPEL_USUARIO_COMUM))
                .thenReturn(Optional.of(papelSolicitado));
        clearInvocations(usuarioRepository);

        UsuarioRequestDTO request = new UsuarioRequestDTO(
                "Usuário Teste Atualizado",
                "teste@empresa.com",
                null,
                null,
                "1",
                PermissaoResolverService.PAPEL_USUARIO_COMUM,
                List.of(),
                List.of(),
                EscopoFiliaisUsuarioPolicy.SELECIONADAS,
                List.of(),
                true
        );

        assertThrows(IllegalArgumentException.class, () -> service.atualizarUsuario(alvo.getId(), request));
        assertFalse(foiChamado(usuarioRepository, "save"));
    }

    @Test
    void usuarioSupremoNaoPodeSerInativado() {
        UsuarioEntity supremo = new UsuarioEntity();
        supremo.setId(1L);
        supremo.setEmail(usuarioSupremo.email());
        supremo.setLogin(usuarioSupremo.email());
        supremo.setAtivo(true);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(supremo));

        assertThrows(AccessDeniedException.class, () -> service.inativarUsuario(1L));

        verify(usuarioRepository, never()).save(supremo);
    }

    @Test
    void redefinirSenhaPorAdminDeveUsarArgon2EExigirTrocaNoProximoLogin() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin@empresa.com", null, List.of())
        );
        UsuarioEntity operador = new UsuarioEntity();
        operador.setId(99L);
        operador.setEmail("admin@empresa.com");
        operador.setAtivo(true);

        UsuarioEntity alvo = new UsuarioEntity();
        alvo.setId(2L);
        alvo.setEmail("teste@empresa.com");
        alvo.setLogin("teste@empresa.com");
        alvo.setAtivo(true);

        PapelEntity papelOperador = criarPapel(PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA, 100);
        PapelEntity papelAlvo = criarPapel(PermissaoResolverService.PAPEL_USUARIO_COMUM, 10);
        Argon2PasswordEncoder argon2 = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
        String senhaTemporaria = senhaTemporariaTeste();

        when(usuarioRepository.findByEmailIgnoreCase("admin@empresa.com")).thenReturn(Optional.of(operador));
        when(usuarioRepository.findById(alvo.getId())).thenReturn(Optional.of(alvo));
        when(papelVinculoRepository.findAllByUsuarioId(operador.getId())).thenReturn(List.of(criarVinculo(papelOperador)));
        when(papelVinculoRepository.findAllByUsuarioId(alvo.getId())).thenReturn(List.of(criarVinculo(papelAlvo)));
        when(papelRepository.findByNome(PermissaoResolverService.PAPEL_USUARIO_COMUM))
                .thenReturn(Optional.of(papelAlvo));
        when(usuarioRepository.save(alvo)).thenReturn(alvo);

        service.redefinirSenhaPorAdmin(alvo.getId(), senhaTemporaria);

        assertTrue(alvo.isExigeTrocaSenha());
        assertEquals(PasswordHashService.ALGORITMO_ARGON2ID, alvo.getAlgoritmoHash());
        assertTrue(argon2.matches(senhaTemporaria, alvo.getSenhaHash()));
        assertEquals(0, alvo.getTentativasFalha());
        assertNull(alvo.getBloqueadoAte());
        verify(refreshTokenSessionRepository).findAllByUsuarioIdAndRevogadoEmIsNull(alvo.getId());
    }

    @Test
    void resumoSessoesUsuariosIncluiDetalhesDosUsuariosOnline() {
        when(usuarioRepository.agoraPresenca()).thenReturn("2026-07-08T19:20:30-03:00");
        when(usuarioRepository.calcularResumoSessoes(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq("2026-07-08T19:20:30-03:00"))).thenReturn(new UsuarioRepository.UsuarioSessaoResumoProjection() {
            @Override
            public Long getTotalUsuarios() {
                return 3L;
            }

            @Override
            public Long getUsuariosAtivos() {
                return 2L;
            }

            @Override
            public Long getUsuariosInativos() {
                return 1L;
            }

            @Override
            public Long getUsuariosOnline() {
                return 1L;
            }
        });
        when(usuarioRepository.findUsuariosOnlineResumo(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq("2026-07-08T19:20:30-03:00"))).thenReturn(List.of(new UsuarioRepository.UsuarioOnlineResumoProjection() {
            @Override
            public Long getId() {
                return 99L;
            }

            @Override
            public String getNome() {
                return "Admin Online";
            }

            @Override
            public String getEmail() {
                return "admin@empresa.com";
            }

            @Override
            public String getUltimaAtividade() {
                return "2026-07-08T19:20:10.1234567-03:00";
            }

            @Override
            public String getUltimaRotaAcessada() { return "/coletas"; }
        }));

        var recente = org.mockito.Mockito.mock(UsuarioRepository.UsuarioOnlineResumoProjection.class);
        when(recente.getId()).thenReturn(98L);
        when(recente.getNome()).thenReturn("Pessoa recente");
        when(recente.getEmail()).thenReturn("recente@empresa.com");
        when(recente.getUltimaAtividade()).thenReturn("2026-07-08T19:18:10Z");
        when(recente.getUltimaRotaAcessada()).thenReturn("/cotacoes");
        when(usuarioRepository.findUsuariosRecentesResumo(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq("2026-07-08T19:20:30-03:00"))).thenReturn(List.of(recente));

        var resultado = service.resumoSessoesUsuarios();

        assertEquals(3, resultado.totalUsuarios());
        assertEquals(2, resultado.usuariosAtivos());
        assertEquals(1, resultado.usuariosInativos());
        assertEquals(1, resultado.usuariosOnline());
        assertEquals(1, resultado.usuariosOnlineDetalhes().size());
        assertEquals("99", resultado.usuariosOnlineDetalhes().get(0).id());
        assertEquals("Admin Online", resultado.usuariosOnlineDetalhes().get(0).nome());
        assertEquals("admin@empresa.com", resultado.usuariosOnlineDetalhes().get(0).email());
        assertEquals("Coletas", resultado.usuariosOnlineDetalhes().get(0).ultimaRotaAcessada());
        assertEquals(1, resultado.usuariosRecentes().size());
        assertEquals("98", resultado.usuariosRecentes().get(0).id());
        assertEquals("Cotações", resultado.usuariosRecentes().get(0).ultimaRotaAcessada());
        assertEquals(
                OffsetDateTime.parse("2026-07-08T19:20:10.1234567-03:00"),
                resultado.usuariosOnlineDetalhes().get(0).ultimaAtividade()
        );
    }

    private ContextoAtualizacao prepararContextoAtualizacao(String papelSolicitadoNome) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin@empresa.com", null, List.of())
        );

        UsuarioEntity operador = new UsuarioEntity();
        operador.setId(99L);
        operador.setEmail("admin@empresa.com");
        operador.setAtivo(true);

        SetorEntity setor = new SetorEntity();
        setor.setId(1L);
        setor.setNome("Logística");
        setor.setFiliaisPermitidas(Set.of("Matriz"));

        UsuarioEntity alvo = new UsuarioEntity();
        alvo.setId(2L);
        alvo.setNome("Usuário Teste");
        alvo.setEmail("teste@empresa.com");
        alvo.setLogin("teste@empresa.com");
        alvo.setAtivo(true);
        alvo.setSetor(setor);

        PapelEntity papelOperador = criarPapel(PermissaoResolverService.PAPEL_ADMIN_PLATAFORMA, 100);
        PapelEntity papelAtual = criarPapel(PermissaoResolverService.PAPEL_USUARIO_COMUM, 10);
        PapelEntity papelSolicitado = criarPapel(papelSolicitadoNome, PermissaoResolverService.PAPEL_ADMIN_ACESSO.equals(papelSolicitadoNome) ? 50 : 10);

        when(usuarioRepository.findByEmailIgnoreCase("admin@empresa.com")).thenReturn(Optional.of(operador));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(alvo));
        when(usuarioRepository.existsByEmailIgnoreCaseAndIdNot("teste@empresa.com", 2L)).thenReturn(false);
        when(usuarioRepository.existsByLoginIgnoreCaseAndIdNot("teste@empresa.com", 2L)).thenReturn(false);
        when(setorRepository.findById(1L)).thenReturn(Optional.of(setor));
        when(papelVinculoRepository.findAllByUsuarioId(99L)).thenReturn(List.of(criarVinculo(papelOperador)));
        when(papelVinculoRepository.findAllByUsuarioId(2L)).thenReturn(List.of(criarVinculo(papelAtual)));

        return new ContextoAtualizacao(alvo, setor, papelSolicitado);
    }

    private PapelEntity criarPapel(String nome, int nivel) {
        PapelEntity papel = new PapelEntity();
        papel.setNome(nome);
        papel.setNivel(nivel);
        return papel;
    }

    private UsuarioPapelVinculo criarVinculo(PapelEntity papel) {
        UsuarioPapelVinculo vinculo = new UsuarioPapelVinculo();
        vinculo.setPapel(papel);
        return vinculo;
    }

    private PermissaoEntity criarPermissao(Long id, String chaveLegado) {
        PermissaoEntity permissao = new PermissaoEntity();
        permissao.setId(id);
        permissao.setChave(chaveLegado);
        permissao.setChaveLegado(chaveLegado);
        permissao.setNome(chaveLegado);
        return permissao;
    }

    private UsuarioPermissaoOverride criarOverride(UsuarioEntity usuario, PermissaoEntity permissao, String tipo) {
        UsuarioPermissaoOverride override = new UsuarioPermissaoOverride();
        override.setUsuario(usuario);
        override.setPermissao(permissao);
        override.setTipo(tipo);
        return override;
    }

    private boolean foiChamado(Object mock, String nomeMetodo) {
        return mockingDetails(mock).getInvocations().stream()
                .anyMatch(invocacao -> nomeMetodo.equals(invocacao.getMethod().getName()));
    }

    private String senhaTemporariaTeste() {
        return "T3mp@" + UUID.randomUUID();
    }

    private <T> T argumentoSalvo(Object mock, Class<T> tipoEsperado) {
        List<Object> argumentos = mockingDetails(mock).getInvocations().stream()
                .filter(invocacao -> "save".equals(invocacao.getMethod().getName()))
                .map(invocacao -> invocacao.getArguments()[0])
                .toList();
        assertEquals(1, argumentos.size());

        Object argumento = Objects.requireNonNull(argumentos.get(0));
        assertTrue(tipoEsperado.isInstance(argumento));
        return tipoEsperado.cast(argumento);
    }

    private void assertSequenciaDeMetodos(Object mock, String... metodosEsperados) {
        List<String> metodosChamados = mockingDetails(mock).getInvocations().stream()
                .map(invocacao -> invocacao.getMethod().getName())
                .filter(nome -> List.of(metodosEsperados).contains(nome))
                .toList();
        assertEquals(List.of(metodosEsperados), metodosChamados);
    }

    private record ContextoAtualizacao(
            UsuarioEntity alvo,
            SetorEntity setor,
            PapelEntity papelSolicitado
    ) {
    }

    private static final class StubEscopoFiliaisUsuarioStore extends EscopoFiliaisUsuarioStore {
        private StubEscopoFiliaisUsuarioStore() {
            super(null);
        }

        @Override
        public void carregarNoUsuario(UsuarioEntity usuario) {
        }

        @Override
        public void salvar(UsuarioEntity usuario) {
        }
    }
}
