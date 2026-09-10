package com.dashboard.api.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DevDatabaseIsolationValidatorTest {

    @Test
    void devePermitirBancoDevSeparado() {
        DevDatabaseIsolationValidator validator = validator(
                "dev",
                "",
                "jdbc:sqlserver://localhost:1433;databaseName=DASHBOARDS_DEV;encrypt=true"
        );

        assertThatCode(validator::validarBancoDeDesenvolvimento).doesNotThrowAnyException();
    }

    @Test
    void deveBloquearBancoProducaoNoProfileDev() {
        DevDatabaseIsolationValidator validator = validator(
                "dev",
                "",
                "jdbc:sqlserver://localhost:1433;databaseName=DASHBOARDS;encrypt=true"
        );

        assertThatThrownBy(validator::validarBancoDeDesenvolvimento)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DEV nao pode usar o banco DASHBOARDS");
    }

    @Test
    void deveExigirDatabaseNameExplicitoNoProfileDev() {
        DevDatabaseIsolationValidator validator = validator(
                "dev",
                "",
                "jdbc:sqlserver://localhost:1433;encrypt=true"
        );

        assertThatThrownBy(validator::validarBancoDeDesenvolvimento)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("databaseName explicito");
    }

    @Test
    void deveIgnorarValidacaoForaDeDev() {
        DevDatabaseIsolationValidator validator = validator(
                "prod",
                "",
                "jdbc:sqlserver://localhost:1433;databaseName=DASHBOARDS;encrypt=true"
        );

        assertThatCode(validator::validarBancoDeDesenvolvimento).doesNotThrowAnyException();
    }

    @Test
    void deveExtrairDatabaseAlternativo() {
        assertThat(DevDatabaseIsolationValidator.extrairNomeBanco("jdbc:sqlserver://x;database=DASHBOARDS_DEV"))
                .contains("DASHBOARDS_DEV");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "jdbc:sqlserver://localhost;databaseName={DASHBOARDS}",
        "jdbc:sqlserver://localhost;databaseName=DASHBOARDS_DEV;databaseName=DASHBOARDS",
        "jdbc:sqlserver://localhost;database=DASHBOARDS_DEV;databaseName=DASHBOARDS",
        "jdbc:sqlserver://localhost;password={x;databaseName=DASHBOARDS_DEV};databaseName=DASHBOARDS"
    })
    void deveBloquearBancoProducaoEmUrlsAmbiguasOuEscapadas(String url) {
        assertThatThrownBy(validator("dev", "", url)::validarBancoDeDesenvolvimento)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void profileAtivoNaoPodeOcultarMarcadorDevDoAmbiente() {
        var validator = validator("", "development", "jdbc:sqlserver://localhost;databaseName=DASHBOARDS");
        var environment = new MockEnvironment();
        environment.setActiveProfiles("metrics");
        ReflectionTestUtils.setField(validator, "environment", environment);
        assertThatThrownBy(validator::validarBancoDeDesenvolvimento).isInstanceOf(IllegalStateException.class);
    }

    private static DevDatabaseIsolationValidator validator(String profiles, String environment, String datasourceUrl) {
        DevDatabaseIsolationValidator validator = new DevDatabaseIsolationValidator();
        ReflectionTestUtils.setField(validator, "springProfilesActive", profiles);
        ReflectionTestUtils.setField(validator, "appEnvironment", environment);
        ReflectionTestUtils.setField(validator, "datasourceUrl", datasourceUrl);
        return validator;
    }
}
