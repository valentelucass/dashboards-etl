package com.dashboard.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dashboard.api.repository.DimMotoristaRepository;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.ManifestosCostDataRepository;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.service.ManifestosCostGoalService;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.zaxxer.hikari.HikariDataSource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.autoconfigure.jdbc.DataSourceHealthContributorAutoConfiguration;
import org.springframework.boot.actuate.health.CompositeHealthContributor;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.orm.jpa.EntityManagerFactoryInfo;

class ConexoesDashboardConfigTest {

    @Test
    void calcularManifestosDeixaConexaoOperacionalLivreDuranteLeituraAnalitica() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        HibernateJpaAutoConfiguration.class, TransactionAutoConfiguration.class))
                .withUserConfiguration(ConexoesDashboardConfig.class, PersistenciaDashboardConfig.class,
                        ManifestosCostGoalService.class)
                .withBean(ManifestosCostDataRepository.class, () -> mock(ManifestosCostDataRepository.class))
                .withBean(EscopoFilialService.class, () -> mock(EscopoFilialService.class))
                .withPropertyValues("spring.datasource.url=jdbc:h2:mem:custo-manifestos;MODE=MSSQLServer",
                        "spring.datasource.hikari.maximum-pool-size=1", "spring.jpa.hibernate.ddl-auto=none")
                .run(context -> {
                    var pool = context.getBean("dataSource", HikariDataSource.class);
                    var relatorio = context.getBean(ManifestosCostGoalService.class);
                    var filtro = new FiltroConsultaDTO(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2), Map.of());
                    var prazo = new QueryTimeoutException("prazo do relatório");
                    when(context.getBean(ManifestosCostDataRepository.class).buscarCustosDiarios(filtro))
                            .thenAnswer(invocation -> {
                                assertThat(pool.getHikariPoolMXBean().getActiveConnections()).isZero();
                                throw prazo;
                            });
                    assertThatThrownBy(() -> relatorio.calcular(filtro, BigDecimal.ZERO)).isSameAs(prazo);
                    assertThatThrownBy(() -> relatorio.calcular(filtro, filtro, BigDecimal.ZERO)).isSameAs(prazo);
                });
    }

    @Test
    void separaJdbcEJpaEMantemAcessoOperacionalComPoolAnaliticoLotado() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
                        DataSourceHealthContributorAutoConfiguration.class))
                .withUserConfiguration(ConexoesDashboardConfig.class, PersistenciaDashboardConfig.class)
                .withPropertyValues(
                        "spring.datasource.url=jdbc:h2:mem:conexoes-dashboard;MODE=MSSQLServer",
                        "spring.datasource.hikari.maximum-pool-size=1",
                        "spring.jpa.hibernate.ddl-auto=none",
                        "spring.jdbc.template.query-timeout=30s",
                        "dashboard.consultas-analiticas.conexoes=1",
                        "dashboard.consultas-analiticas.espera-conexao-ms=500")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    var operacional = context.getBean("dataSource", HikariDataSource.class);
                    var analitico = context.getBean("dataSourceAnalitico", HikariDataSource.class);
                    var jdbcOperacional = context.getBean(JdbcTemplate.class);
                    var jdbcAnalitico = context.getBean("jdbcTemplateAnalitico", JdbcTemplate.class);
                    assertThat(jdbcOperacional.getDataSource()).isSameAs(operacional);
                    assertThat(jdbcAnalitico.getDataSource()).isSameAs(analitico);
                    assertThat(jdbcAnalitico.getQueryTimeout()).isEqualTo(30);
                    assertThat(context.getBean("namedParameterJdbcTemplateAnalitico", NamedParameterJdbcTemplate.class)
                            .getJdbcTemplate()).isSameAs(jdbcAnalitico);

                    assertThat(context.getBean("entityManagerFactory", EntityManagerFactoryInfo.class).getDataSource())
                            .isSameAs(operacional);
                    assertThat(context.getBean("entityManagerFactoryAnalitico", EntityManagerFactoryInfo.class).getDataSource())
                            .isSameAs(analitico);

                    jdbcOperacional.execute("CREATE SCHEMA dbo");
                    jdbcOperacional.execute("CREATE SCHEMA acesso");
                    jdbcOperacional.execute("CREATE TABLE dbo.vw_dim_motoristas ([NomeMotorista] varchar(255))");
                    jdbcOperacional.execute("INSERT INTO dbo.vw_dim_motoristas VALUES ('Motorista A')");
                    jdbcOperacional.execute("CREATE TABLE acesso.usuarios (id bigint PRIMARY KEY)");
                    var motoristas = context.getBean(DimMotoristaRepository.class);
                    var usuarios = context.getBean(UsuarioRepository.class);
                    try (var ocupada = analitico.getConnection()) {
                        assertThat(analitico.getHikariPoolMXBean().getActiveConnections()).isEqualTo(1);
                        assertThat(usuarios.count()).isZero();
                        var db = context.getBean("dbHealthContributor", CompositeHealthContributor.class);
                        assertThat(((HealthIndicator) db.getContributor("dataSource")).health().getStatus()).isEqualTo(Status.UP);
                        assertThat(((HealthIndicator) db.getContributor("dataSourceAnalitico")).health().getStatus()).isEqualTo(Status.DOWN);
                        assertThatThrownBy(motoristas::findDistinctNomes).hasRootCauseInstanceOf(java.sql.SQLTransientConnectionException.class);
                    }
                    assertThat(motoristas.findDistinctNomes()).containsExactly("Motorista A");
                });
    }
}
