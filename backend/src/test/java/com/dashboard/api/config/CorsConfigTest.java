package com.dashboard.api.config;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CorsConfigTest {

    @Test
    void deveExporCabecalhosDeDownloadEEsperaNoFrontend() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(
                config,
                "origensPermitidas",
                "https://analytics.rodogarcia.com.br"
        );
        TestCorsRegistry registry = new TestCorsRegistry();

        config.addCorsMappings(registry);

        CorsConfiguration cors = registry.configuracoes().get("/api/**");
        assertThat(cors).isNotNull();
        assertThat(cors.getAllowedOrigins()).contains("https://analytics.rodogarcia.com.br");
        assertThat(cors.getAllowedHeaders()).contains("Authorization", "Content-Type", "X-API-KEY", "X-Dashboard-Route");
        assertThat(cors.getExposedHeaders()).contains("Content-Disposition", "Content-Length", "Retry-After");
    }

    @Test
    void corsConfigurationSourceDeveAceitarPreflightDoFrontendProducao() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(
                config,
                "origensPermitidas",
                "https://analytics.rodogarcia.com.br/"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/auth/login");

        CorsConfiguration cors = config.corsConfigurationSource().getCorsConfiguration(request);

        assertThat(cors).isNotNull();
        assertThat(cors.checkOrigin("https://analytics.rodogarcia.com.br"))
                .isEqualTo("https://analytics.rodogarcia.com.br");
        assertThat(cors.checkHttpMethod(HttpMethod.POST)).contains(HttpMethod.POST);
        assertThat(cors.checkHttpMethod(HttpMethod.PATCH)).contains(HttpMethod.PATCH);
        assertThat(cors.getExposedHeaders()).contains("Retry-After");
        assertThat(cors.checkHeaders(List.of("content-type", "x-dashboard-route")))
                .contains("content-type", "x-dashboard-route");
    }

    @Test
    void deveRejeitarLocalhostQuandoAmbienteForProducao() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "origensPermitidas", "http://localhost:5173,http://127.0.0.1:5173");
        ReflectionTestUtils.setField(config, "springProfilesActive", "prod");
        ReflectionTestUtils.setField(config, "appEnvironment", "");

        assertThatThrownBy(config::validarOrigensDeProducao)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CORS de produção");
    }

    @Test
    void deveRejeitarOrigemHttpPublicaQuandoAmbienteForProducao() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "origensPermitidas", "http://analytics.rodogarcia.com.br");
        ReflectionTestUtils.setField(config, "springProfilesActive", "prod");
        ReflectionTestUtils.setField(config, "appEnvironment", "");

        assertThatThrownBy(config::validarOrigensDeProducao)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("somente origens HTTPS");
    }

    @Test
    void devePermitirLocalhostSomenteForaDeProducao() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "origensPermitidas", "http://localhost:5173,http://127.0.0.1:5173");
        ReflectionTestUtils.setField(config, "springProfilesActive", "dev");
        ReflectionTestUtils.setField(config, "appEnvironment", "");

        assertThatCode(config::validarOrigensDeProducao).doesNotThrowAnyException();
    }

    @Test
    void deveRejeitarMisturaDeOrigemLocalComPublica() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "origensPermitidas", "http://localhost:5173,https://analytics.rodogarcia.com.br");
        ReflectionTestUtils.setField(config, "springProfilesActive", "dev");
        ReflectionTestUtils.setField(config, "appEnvironment", "");

        assertThatThrownBy(config::validarOrigensDeProducao)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("misturar origens locais");
    }

    @Test
    void deveFalharSemOrigemExplicita() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "origensPermitidas", "");
        ReflectionTestUtils.setField(config, "springProfilesActive", "prod");
        ReflectionTestUtils.setField(config, "appEnvironment", "");

        assertThatThrownBy(config::validarOrigensDeProducao)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CORS_ORIGENS_PERMITIDAS");
    }

    private static class TestCorsRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> configuracoes() {
            return getCorsConfigurations();
        }
    }
}
