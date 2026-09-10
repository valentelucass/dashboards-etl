package com.dashboard.api.util;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThat;

class SqlServerJdbcUrlTest {
    @ParameterizedTest
    @ValueSource(strings = {
        "jdbc:sqlserver://localhost;databaseName=DASHBOARDS_DEV",
        "jdbc:sqlserver://localhost;DATABASE = DASHBOARDS_DEV;encrypt=true;",
        "jdbc:sqlserver://localhost;databaseName={DASHBOARDS_DEV}",
        "jdbc:sqlserver://localhost;password={s;databaseName=DASHBOARDS;}}x};databaseName=DASHBOARDS_DEV"
    })
    void leNomeSemConfundirPropriedadesEscapadas(String url) {
        assertThat(SqlServerJdbcUrl.nomeBancoExplicito(url)).contains("DASHBOARDS_DEV");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
        "", "jdbc:h2:mem:test;databaseName=DASHBOARDS_DEV", "jdbc:sqlserver://localhost",
        "jdbc:sqlserver://localhost;databaseName=", "jdbc:sqlserver://localhost;databaseName={}",
        "jdbc:sqlserver://localhost;databaseName={DEV", "jdbc:sqlserver://localhost;databaseName={DEV}suffix",
        "jdbc:sqlserver://localhost;databaseName=DEV;database=DEV", "jdbc:sqlserver://localhost;databaseName=DEV;broken",
        "jdbc:sqlserver://localhost;databaseName=D{EV}", "jdbc:sqlserver://localhost;=DEV"
    })
    void rejeitaUrlsAusentesInvalidasOuAmbiguas(String url) {
        assertThat(SqlServerJdbcUrl.nomeBancoExplicito(url)).isEmpty();
    }
}
