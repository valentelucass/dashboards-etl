package com.dashboard.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.JdbcTemplateAutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import java.util.Map;

class ConsultaJdbcTimeoutTest {
    @Test
    void configuracaoRealEncaminhaPrazoDeConfirmacaoAoDriverSqlServer() throws Exception {
        var properties = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml")).get(0);

        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class))
                .withInitializer(context -> context.getEnvironment().getPropertySources().addLast(properties))
                .withPropertyValues("spring.datasource.driver-class-name=org.h2.Driver", "DB_URL=jdbc:h2:mem:config",
                        "DB_USER=fixture", "DB_PASSWORD=fixture")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(HikariDataSource.class).getDataSourceProperties())
                            .containsEntry("queryTimeout", "30")
                            .containsEntry("cancelQueryTimeout", "5");
                });
    }

    @Test
    void configuracaoRealAplicaTrintaSegundosAoStatementJdbcInclusiveParametrosNomeados() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet result = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement("SELECT ?")).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(result);
        when(result.next()).thenReturn(true, false);
        when(result.getInt(anyInt())).thenReturn(1);
        var properties = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml")).get(0);

        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(JdbcTemplateAutoConfiguration.class))
                .withBean(DataSource.class, () -> dataSource)
                .withInitializer(context -> context.getEnvironment().getPropertySources().addLast(properties))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(JdbcTemplate.class).getQueryTimeout()).isEqualTo(30);
                    context.getBean(NamedParameterJdbcTemplate.class)
                            .query("SELECT :id", Map.of("id", 1), (rs, row) -> rs.getInt(1));
                    verify(statement).setQueryTimeout(30);
                    verify(connection).close();
                });
    }
}
