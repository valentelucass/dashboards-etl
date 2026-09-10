package com.dashboard.api.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@EnabledIfSystemProperty(named = "dashboard.quality.isolated", matches = "true")
class QualityIsolationTest {
    @Test
    void perfilNaoDisponibilizaDriverSqlServerNemCarregadorDeCredenciais() {
        assertThatThrownBy(() -> Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver"))
                .isInstanceOf(ClassNotFoundException.class);
        assertThatThrownBy(() -> Class.forName("me.paulschwarz.springdotenv.DotenvPropertySource"))
                .isInstanceOf(ClassNotFoundException.class);
        assertThat(System.getProperty("spring.flyway.enabled")).isEqualTo("false");
        assertThat(System.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("none");
        assertThat(System.getProperty("spring.config.location")).isEqualTo("classpath:application-quality.properties");
        assertThat(System.getProperty("server.port")).isEqualTo("0");
    }
}
