package com.dashboard.api.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.lang.NonNull;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private static final List<String> HEADERS_EXPOSTOS = List.of("Content-Disposition", "Content-Length", "Retry-After");

    private static final List<String> HEADERS_PERMITIDOS = List.of(
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "X-API-KEY",
            "X-Dashboard-Route"
    );

    @Value("${cors.origens-permitidas:${cors.origem-permitida:}}")
    private String origensPermitidas;

    @Value("${spring.profiles.active:}")
    private String springProfilesActive;

    @Value("${app.environment:${ENVIRONMENT:}}")
    private String appEnvironment;

    @Autowired
    private Environment environment;

    private static final Set<String> HOSTS_LOCAIS = Set.of("localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]");

    @PostConstruct
    void validarOrigensDeProducao() {
        String[] origens = parseOrigensPermitidas();
        boolean possuiOrigemLocal = Arrays.stream(origens)
                .map(CorsConfig::extrairHost)
                .anyMatch(HOSTS_LOCAIS::contains);
        boolean possuiOrigemPublica = Arrays.stream(origens)
                .map(CorsConfig::extrairHost)
                .anyMatch(host -> !HOSTS_LOCAIS.contains(host));

        if (possuiOrigemLocal && possuiOrigemPublica) {
            throw new IllegalStateException("CORS não deve misturar origens locais com origens públicas.");
        }

        if (!ambienteProducao()) {
            return;
        }

        if (possuiOrigemLocal) {
            throw new IllegalStateException("CORS de produção não pode permitir origens localhost/127.0.0.1/0.0.0.0.");
        }

        boolean possuiOrigemHttp = Arrays.stream(origens)
                .map(String::toLowerCase)
                .anyMatch(origem -> origem.startsWith("http://"));
        if (possuiOrigemHttp) {
            throw new IllegalStateException("CORS de produção deve permitir somente origens HTTPS.");
        }
    }

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(parseOrigensPermitidas())
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders(HEADERS_PERMITIDOS.toArray(String[]::new))
                .exposedHeaders(HEADERS_EXPOSTOS.toArray(String[]::new))
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", criarConfiguracaoCors());
        return source;
    }

    private CorsConfiguration criarConfiguracaoCors() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(parseOrigensPermitidas()));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(HEADERS_PERMITIDOS);
        configuration.setExposedHeaders(HEADERS_EXPOSTOS);
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        return configuration;
    }

    @NonNull
    private String[] parseOrigensPermitidas() {
        String[] origens = Arrays.stream(origensPermitidas.split(","))
                .map(CorsConfig::normalizarOrigem)
                .filter(origem -> !origem.isBlank())
                .toArray(String[]::new);
        if (origens.length == 0) {
            throw new IllegalStateException("CORS_ORIGENS_PERMITIDAS precisa informar ao menos uma origem.");
        }
        return Objects.requireNonNull(origens, "origensPermitidas");
    }

    private static String normalizarOrigem(String origem) {
        String valor = origem == null ? "" : origem.trim();
        while (valor.endsWith("/")) {
            valor = valor.substring(0, valor.length() - 1);
        }
        return valor;
    }

    private boolean ambienteProducao() {
        String marcadoresAmbiente = marcadoresAmbiente();
        return Arrays.stream(marcadoresAmbiente.split(","))
                .map(String::trim)
                .map(valor -> valor.toLowerCase(Locale.ROOT))
                .anyMatch(valor -> valor.equals("prod") || valor.equals("production") || valor.equals("producao"));
    }

    private String marcadoresAmbiente() {
        if (environment != null && environment.getActiveProfiles().length > 0) {
            return String.join(",", environment.getActiveProfiles());
        }
        return springProfilesActive + "," + appEnvironment;
    }

    private static String extrairHost(String origem) {
        String valor = origem.toLowerCase(Locale.ROOT)
                .replace("http://", "")
                .replace("https://", "");
        int barra = valor.indexOf('/');
        if (barra >= 0) {
            valor = valor.substring(0, barra);
        }
        if (valor.startsWith("[")) {
            int fechamentoIpv6 = valor.indexOf(']');
            if (fechamentoIpv6 >= 0) {
                return valor.substring(0, fechamentoIpv6 + 1);
            }
        }
        int porta = valor.lastIndexOf(':');
        if (porta > 0 && !valor.startsWith("[")) {
            valor = valor.substring(0, porta);
        }
        return valor;
    }
}
