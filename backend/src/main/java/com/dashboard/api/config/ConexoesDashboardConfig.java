package com.dashboard.api.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.autoconfigure.jdbc.JdbcProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(JdbcProperties.class)
public class ConexoesDashboardConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.hikari")
    HikariDataSource dataSource(DataSourceProperties properties) {
        HikariDataSource pool = criarPool(properties);
        pool.setPoolName("dashboard-operacional");
        return pool;
    }

    @Bean
    @ConsultaAnalitica
    HikariDataSource dataSourceAnalitico(
            DataSourceProperties properties,
            @Qualifier("dataSource") HikariDataSource operacional,
            @Value("${dashboard.consultas-analiticas.conexoes:3}") int tamanho,
            @Value("${dashboard.consultas-analiticas.espera-conexao-ms:2000}") long esperaMillis
    ) {
        HikariDataSource pool = criarPool(properties);
        pool.setPoolName("dashboard-analitico");
        pool.setMaximumPoolSize(tamanho);
        pool.setMinimumIdle(0);
        pool.setConnectionTimeout(esperaMillis);
        pool.setConnectionInitSql(operacional.getConnectionInitSql());
        pool.setDataSourceProperties(operacional.getDataSourceProperties());
        return pool;
    }

    @Bean
    @Primary
    JdbcTemplate jdbcTemplate(@Qualifier("dataSource") HikariDataSource pool, JdbcProperties properties) {
        return criarJdbcTemplate(pool, properties);
    }

    @Bean
    @Primary
    NamedParameterJdbcTemplate namedParameterJdbcTemplate(@Qualifier("jdbcTemplate") JdbcTemplate template) {
        return new NamedParameterJdbcTemplate(template);
    }

    @Bean
    @ConsultaAnalitica
    JdbcTemplate jdbcTemplateAnalitico(@ConsultaAnalitica HikariDataSource pool, JdbcProperties properties) {
        return criarJdbcTemplate(pool, properties);
    }

    @Bean
    @ConsultaAnalitica
    NamedParameterJdbcTemplate namedParameterJdbcTemplateAnalitico(@ConsultaAnalitica JdbcTemplate template) {
        return new NamedParameterJdbcTemplate(template);
    }

    private HikariDataSource criarPool(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }

    private JdbcTemplate criarJdbcTemplate(HikariDataSource pool, JdbcProperties properties) {
        JdbcTemplate template = new JdbcTemplate(pool);
        var settings = properties.getTemplate();
        template.setFetchSize(settings.getFetchSize());
        template.setMaxRows(settings.getMaxRows());
        if (settings.getQueryTimeout() != null) {
            template.setQueryTimeout(Math.toIntExact(settings.getQueryTimeout().toSeconds()));
        }
        return template;
    }
}
