package com.dashboard.api.security;

import com.dashboard.api.repository.acesso.UsuarioSessaoSqlRepository;
import com.dashboard.api.service.acesso.AutenticacaoService;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FiltroValidacaoJwtTest {
    @Mock GerenciadorTokenJwt tokens;
    @Mock AutenticacaoService authentication;
    @Mock UsuarioSessaoSqlRepository sessions;
    @Mock FilterChain chain;
    FiltroValidacaoJwt filter;
    MockHttpServletRequest request;
    MockHttpServletResponse response;

    @BeforeEach
    void prepare() {
        SecurityContextHolder.clearContext();
        filter = new FiltroValidacaoJwt(tokens, authentication, sessions);
        request = new MockHttpServletRequest("GET", "/api/painel/coletas");
        response = new MockHttpServletResponse();
    }

    @AfterEach
    void clearContext() { SecurityContextHolder.clearContext(); }

    @Test void pulsoDePresencaDelegaAAtividadeAoControllerSemHeartbeatDuplicado() throws Exception {
        usuarioAutorizado();
        request.setRequestURI("/api/sessao/presenca");
        filter.doFilter(request, response, chain);
        verifyNoInteractions(sessions);
        verify(chain).doFilter(request, response);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"Basic abc", "bearer abc", "Bearer"})
    void semBearerNaoConsultaIdentidadeNemRegistraAtividade(String header) throws Exception {
        if (header != null) request.addHeader("Authorization", header);
        filter.doFilter(request, response, chain);
        verifyNoInteractions(tokens, authentication, sessions);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenInvalidoNaoConsultaPermissoes() throws Exception {
        request.addHeader("Authorization", "Bearer invalido");
        filter.doFilter(request, response, chain);
        verifyNoInteractions(authentication, sessions);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void usuarioSemAuthoritiesNaoAutenticaNemRegistraAtividade() throws Exception {
        tokenValido();
        when(authentication.authoritiesFor("usuario")).thenReturn(List.of());
        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(sessions);
        verify(chain).doFilter(request, response);
    }

    @ParameterizedTest
    @CsvSource({"/coletas?cliente=privado,/coletas", "https://externo.test,/api/painel/coletas", "'/fretes',/fretes"})
    void autenticaERegistraSomenteRotaSemParametros(String header, String expected) throws Exception {
        usuarioAutorizado();
        request.addHeader("X-Dashboard-Route", header);
        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("usuario");
        verify(sessions).registrarAtividade("usuario", expected);
        verify(chain).doFilter(request, response);
    }

    @Test
    void limitaRotaAoTamanhoPersistido() throws Exception {
        usuarioAutorizado();
        request.addHeader("X-Dashboard-Route", "/" + "a".repeat(200));
        filter.doFilter(request, response, chain);
        verify(sessions).registrarAtividade("usuario", "/" + "a".repeat(99));
    }

    @Test
    void dispatchAssincronoDeExportacaoTambemAutentica() throws Exception {
        usuarioAutorizado();
        request.setDispatcherType(DispatcherType.ASYNC);
        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication().isAuthenticated()).isTrue();
        verify(chain).doFilter(request, response);
    }

    @Test
    void falhaDePermissoesNaoConcedeAcesso() throws Exception {
        tokenValido();
        when(authentication.authoritiesFor("usuario")).thenThrow(new IllegalStateException("falha simulada"));
        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(sessions);
        verify(chain).doFilter(request, response);
    }

    @Test
    void falhaDeHeartbeatNaoDerrubaAutenticacaoValida() throws Exception {
        usuarioAutorizado();
        doThrow(new IllegalStateException("falha simulada")).when(sessions)
                .registrarAtividade("usuario", "/api/painel/coletas");
        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication().isAuthenticated()).isTrue();
        verify(chain).doFilter(request, response);
    }

    private void tokenValido() {
        request.addHeader("Authorization", "Bearer valido");
        when(tokens.tokenValido("valido")).thenReturn(true);
        when(tokens.extrairUsuario("valido")).thenReturn("usuario");
    }

    private void usuarioAutorizado() {
        tokenValido();
        when(authentication.authoritiesFor("usuario"))
                .thenReturn(List.of(new SimpleGrantedAuthority("ROLE_USUARIO")));
    }
}
