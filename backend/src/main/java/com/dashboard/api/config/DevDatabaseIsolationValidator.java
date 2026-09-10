package com.dashboard.api.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import com.dashboard.api.util.SqlServerJdbcUrl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class DevDatabaseIsolationValidator {

    private static final String BANCO_PRODUCAO = "DASHBOARDS";

    @Value("${spring.profiles.active:}")
    private String springProfilesActive;

    @Value("${app.environment:${ENVIRONMENT:}}")
    private String appEnvironment;

    @Value("${spring.datasource.url:${DB_URL:}}")
    private String datasourceUrl;

    @Autowired
    private Environment environment;

    @PostConstruct
    void validarBancoDeDesenvolvimento() {
        if (!ambienteDesenvolvimento()) {
            return;
        }

        String nomeBanco = extrairNomeBanco(datasourceUrl)
                .orElseThrow(() -> new IllegalStateException(
                        "DEV exige DB_URL com databaseName explicito e diferente de DASHBOARDS."));

        if (BANCO_PRODUCAO.equalsIgnoreCase(nomeBanco)) {
            throw new IllegalStateException(
                    "DEV nao pode usar o banco DASHBOARDS de producao. Configure .env.development.local com um banco DEV separado.");
        }
    }

    private boolean ambienteDesenvolvimento() {
        return Arrays.stream(marcadoresAmbiente().split(","))
                .map(String::trim)
                .map(valor -> valor.toLowerCase(Locale.ROOT))
                .anyMatch(valor -> valor.equals("dev") || valor.equals("development") || valor.equals("desenvolvimento"));
    }

    private String marcadoresAmbiente() {
        String ativos = environment == null ? "" : String.join(",", environment.getActiveProfiles());
        return ativos + "," + springProfilesActive + "," + appEnvironment;
    }

    static Optional<String> extrairNomeBanco(String jdbcUrl) {
        return SqlServerJdbcUrl.nomeBancoExplicito(jdbcUrl);
    }
}
