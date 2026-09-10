package com.dashboard.api.config;

import com.dashboard.api.controller.PerformanceController;
import com.dashboard.api.repository.acesso.UsuarioSessaoSqlRepository;
import com.dashboard.api.security.*;
import com.dashboard.api.service.DashboardExportService;
import com.dashboard.api.service.PerformanceDashboardService;
import com.dashboard.api.service.acesso.AuditService;
import com.dashboard.api.service.acesso.AutenticacaoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** MVC, JWT, filtros, headers e autorização reais; nenhum Boot, socket, datasource ou Flyway. */
class SecurityChainIntegrationTest {
    static AnnotationConfigWebApplicationContext context;
    static MockMvc mvc;
    static AutenticacaoService auth;
    static PerformanceDashboardService service;
    static RateLimitService limits;
    static GerenciadorTokenJwt tokens;

    @BeforeAll static void start() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(TestConfiguration.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean("springSecurityFilterChain", Filter.class)).build();
        auth = context.getBean(AutenticacaoService.class);
        service = context.getBean(PerformanceDashboardService.class);
        limits = context.getBean(RateLimitService.class);
        tokens = context.getBean(GerenciadorTokenJwt.class);
    }
    @AfterAll static void stop() { context.close(); }
    @BeforeEach void defaults() {
        reset(auth, service, limits);
        when(limits.consumirChamadaApi(anyString())).thenReturn(new RateLimitService.RateLimitDecision(true, 0, 1));
        when(limits.consumirExportacao(anyString())).thenReturn(new RateLimitService.RateLimitDecision(true, 0, 1));
        when(auth.authoritiesFor("permitido")).thenReturn(List.of(new SimpleGrantedAuthority(PermissaoCatalogo.authorityForKey("performance"))));
        when(auth.authoritiesFor("sem-permissao")).thenReturn(List.of(new SimpleGrantedAuthority("ROLE_USUARIO_COMUM")));
    }
    @AfterEach void clean() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest
    @ValueSource(strings = {"overview", "serie-temporal", "status", "historico", "drilldown", "aging", "tabela/paginada", "exportacao"})
    void rotasReaisRecusamAnonimoAntesDoServico(String route) throws Exception {
        mvc.perform(get("/api/painel/performance/" + route).param("dataInicio", "2026-08-01").param("dataFim", "2026-08-31"))
                .andExpect(status().isUnauthorized()).andExpect(header().doesNotExist("WWW-Authenticate"));
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings = {"overview", "serie-temporal", "status", "historico", "drilldown", "aging"})
    void jwtValidoSemPermissaoRecebe403(String route) throws Exception {
        mvc.perform(get("/api/painel/performance/" + route).param("dataInicio", "2026-08-01").param("dataFim", "2026-08-31")
                .header("Authorization", "Bearer " + tokens.gerarToken("sem-permissao")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("status").value(403));
        verifyNoInteractions(service);
    }

    @Test void jwtAssinadoComPermissaoChegaAoControllerEContextoNaoVaza() throws Exception {
        mvc.perform(get("/api/painel/performance/status").param("dataInicio", "2026-08-01").param("dataFim", "2026-08-31")
                .header("Authorization", "Bearer " + tokens.gerarToken("permitido")))
                .andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().exists("Content-Security-Policy"))
                .andExpect(header().exists("Strict-Transport-Security"));
        verify(service).buscarStatus(any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        mvc.perform(get("/api/painel/performance/status")).andExpect(status().isUnauthorized());
    }

    @Test void tokenDeOutraChaveNaoAutentica() throws Exception {
        String token = new GerenciadorTokenJwt("outra-chave-sintetica-de-teste-00000000000000000", 5).gerarToken("permitido");
        mvc.perform(get("/api/painel/performance/status").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        verifyNoInteractions(auth, service);
    }

    @Test void limiteBloqueiaServicoMesmoComJwtValido() throws Exception {
        when(limits.consumirChamadaApi(anyString())).thenReturn(new RateLimitService.RateLimitDecision(false, 30, 121));
        mvc.perform(get("/api/painel/performance/status").header("Authorization", "Bearer " + tokens.gerarToken("permitido")))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "30"));
        verifyNoInteractions(service);
    }

    @Test void preflightPermitidoNaoExigeJwtNemConsomeLimite() throws Exception {
        mvc.perform(options("/api/painel/performance/status").header("Origin", "https://portal.example.test")
                .header("Access-Control-Request-Method", "GET").header("Access-Control-Request-Headers", "Authorization,X-Dashboard-Route"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "https://portal.example.test"));
        verifyNoInteractions(auth, limits, service);
    }

    @Test void origemNaoPermitidaEhRecusadaAntesDaAutenticacao() throws Exception {
        mvc.perform(options("/api/painel/performance/status").header("Origin", "https://externo.example.test")
                .header("Access-Control-Request-Method", "GET")).andExpect(status().isForbidden());
        verifyNoInteractions(auth, limits, service);
    }

    @Configuration @EnableWebMvc
    @Import({SegurancaWebConfig.class, PerformanceController.class, AcessoSeguranca.class})
    static class TestConfiguration {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean AutenticacaoService auth() { return mock(AutenticacaoService.class); }
        @Bean PerformanceDashboardService performance() { return mock(PerformanceDashboardService.class); }
        @Bean DashboardExportService exports() { return mock(DashboardExportService.class); }
        @Bean RateLimitService limits() { return mock(RateLimitService.class); }
        @Bean GerenciadorTokenJwt tokens() { return new GerenciadorTokenJwt("chave-sintetica-de-teste-00000000000000000000000", 5); }
        @Bean FiltroValidacaoJwt jwt(GerenciadorTokenJwt tokens, AutenticacaoService auth) { return new FiltroValidacaoJwt(tokens, auth, mock(UsuarioSessaoSqlRepository.class)); }
        @Bean FiltroApiKey apiKey(ObjectMapper mapper) { return new FiltroApiKey("synthetic-internal-key", mapper); }
        @Bean FiltroRateLimitApi rateLimit(RateLimitService limits, ObjectMapper mapper) { return new FiltroRateLimitApi(limits, mock(AuditService.class), new IpClienteResolver(false), mapper); }
        @Bean CorsConfigurationSource corsConfigurationSource() {
            var config = new CorsConfiguration();
            config.setAllowedOrigins(List.of("https://portal.example.test"));
            config.setAllowedMethods(List.of("GET", "OPTIONS"));
            config.setAllowedHeaders(List.of("Authorization", "X-Dashboard-Route"));
            var source = new UrlBasedCorsConfigurationSource();
            source.registerCorsConfiguration("/api/**", config);
            return source;
        }
    }
}
