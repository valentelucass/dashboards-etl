package com.dashboard.api.service.acesso;

import com.dashboard.api.model.acesso.*;
import com.dashboard.api.repository.acesso.*;
import com.dashboard.api.security.PermissaoCatalogo;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Conta acessos às fronteiras SQL com os dois serviços reais, sem cache entre requests. */
class AutorizacaoQueryCountTest {
    final PermissaoRepository catalogo = mock(PermissaoRepository.class);
    final SetorPermissaoTemplateRepository templates = mock(SetorPermissaoTemplateRepository.class);
    final UsuarioPapelVinculoRepository papeis = mock(UsuarioPapelVinculoRepository.class);
    final UsuarioPermissaoOverrideRepository overrides = mock(UsuarioPermissaoOverrideRepository.class);
    final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    final PermissaoResolverService resolver = new PermissaoResolverService(catalogo, templates, papeis, overrides,
            new UsuarioSupremo("synthetic@example.test", "synthetic-unused-password", "Teste", "desenvolvedor", 1000, false));
    final AutenticacaoService auth = new AutenticacaoService(usuarios, null, null, resolver, null, null, null);
    UsuarioEntity usuario;
    PermissaoEntity permissao;

    @BeforeEach void setup() {
        var setor = new SetorEntity(); setor.setId(2L);
        usuario = new UsuarioEntity(); usuario.setId(1L); usuario.setEmail("synthetic@example.test"); usuario.setAtivo(true); usuario.setSetor(setor);
        permissao = new PermissaoEntity(); permissao.setId(3L); permissao.setChave("dashboard.performance.read"); permissao.setChaveLegado("performance"); permissao.setAtivo(true);
        when(usuarios.findByEmailIgnoreCase(usuario.getEmail())).thenReturn(Optional.of(usuario));
        when(catalogo.findAllByAtivoTrue()).thenReturn(List.of(permissao));
    }
    UsuarioPapelVinculo papel(String nome, int nivel) {
        var papel = new PapelEntity(); papel.setNome(nome); papel.setNivel(nivel);
        var vinculo = new UsuarioPapelVinculo(); vinculo.setPapel(papel); return vinculo;
    }

    @ParameterizedTest
    @CsvSource({
        "usuario_comum,false,NONE,false,false", "usuario_comum,true,NONE,true,false",
        "usuario_comum,true,DENY,false,false", "usuario_comum,false,DENY,false,false",
        "usuario_comum,false,GRANT,true,false", "usuario_comum,true,GRANT,true,false",
        "admin_acesso,true,DENY,false,true", "admin_acesso,false,GRANT,true,true",
        "admin_plataforma,false,DENY,true,true", "desenvolvedor,false,DENY,true,true"
    })
    void preservaMatrizAclComUmaConsultaDePapel(String papel, boolean template, String override, boolean permitida, boolean admin) {
        when(papeis.findAllByUsuarioId(1L)).thenReturn(List.of(papel(papel, 10)));
        when(templates.findAllBySetorId(2L)).thenReturn(template ? List.of(new SetorPermissaoTemplate(usuario.getSetor(), permissao)) : List.of());
        if (!override.equals("NONE")) {
            var item = new UsuarioPermissaoOverride(); item.setTipo(override); item.setPermissao(permissao);
            when(overrides.findAllByUsuarioId(1L)).thenReturn(List.of(item));
        }
        var authorities = auth.authoritiesFor(usuario.getEmail()).stream().map(item -> item.getAuthority()).toList();
        assertThat(authorities).contains("ROLE_" + papel.toUpperCase(), admin ? "ROLE_ADMIN" : "ROLE_USER");
        assertThat(authorities.contains(PermissaoCatalogo.authorityForKey("performance"))).isEqualTo(permitida);
        verify(papeis, times(1)).findAllByUsuarioId(1L);
        verify(catalogo, times(1)).findAllByAtivoTrue();
    }

    @Test void revogacaoEhLidaNaProximaRequisicaoSemCache() {
        List<UsuarioPapelVinculo> primeiraLeitura = List.of(papel("admin_plataforma", 100));
        List<UsuarioPapelVinculo> segundaLeitura = List.of(papel("usuario_comum", 10));
        AtomicInteger consultas = new AtomicInteger();
        when(papeis.findAllByUsuarioId(1L)).thenAnswer(ignored ->
                consultas.getAndIncrement() == 0 ? primeiraLeitura : segundaLeitura);
        assertThat(auth.authoritiesFor(usuario.getEmail())).extracting(item -> item.getAuthority()).contains("ROLE_ADMIN");
        assertThat(auth.authoritiesFor(usuario.getEmail())).extracting(item -> item.getAuthority()).doesNotContain("ROLE_ADMIN", PermissaoCatalogo.authorityForKey("performance"));
        verify(papeis, times(2)).findAllByUsuarioId(1L);
    }

    @Test void contaInativaNaoConsultaAcl() {
        usuario.setAtivo(false);
        assertThat(auth.authoritiesFor(usuario.getEmail())).isEmpty();
        verifyNoInteractions(papeis, templates, overrides);
    }

    @Test void trocaObrigatoriaNaoConsultaAcl() {
        usuario.setExigeTrocaSenha(true);
        assertThat(auth.authoritiesFor(usuario.getEmail())).isEmpty();
        verifyNoInteractions(papeis, templates, overrides);
    }

    @Test void semVinculoUsaUsuarioComumSemConcederPermissao() {
        assertThat(auth.authoritiesFor(usuario.getEmail())).extracting(item -> item.getAuthority())
                .containsExactlyInAnyOrder("ROLE_USER", "ROLE_USUARIO_COMUM");
        verify(papeis).findAllByUsuarioId(1L);
    }

    @Test void selecionaMaiorNivelIndependentementeDaOrdemDoRepositorio() {
        when(papeis.findAllByUsuarioId(1L)).thenReturn(List.of(papel("usuario_comum", 10), papel("admin_plataforma", 100)));
        assertThat(auth.authoritiesFor(usuario.getEmail())).extracting(item -> item.getAuthority())
                .contains("ROLE_ADMIN", "ROLE_ADMIN_PLATAFORMA", PermissaoCatalogo.authorityForKey("performance"));
        verify(papeis).findAllByUsuarioId(1L);
        verifyNoInteractions(templates, overrides);
    }
}
