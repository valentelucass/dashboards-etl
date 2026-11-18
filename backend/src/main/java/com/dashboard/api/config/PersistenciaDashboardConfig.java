package com.dashboard.api.config;

import com.dashboard.api.model.VisaoColetasEntity;
import com.dashboard.api.repository.VisaoColetasRepository;
import jakarta.persistence.EntityManagerFactory;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateProperties;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateSettings;
import org.springframework.boot.autoconfigure.orm.jpa.JpaProperties;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;

@Configuration(proxyBeanMethods = false)
@EnableJpaRepositories(
        basePackageClasses = VisaoColetasRepository.class,
        excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = ConsultaAnalitica.class)
)
public class PersistenciaDashboardConfig {

    @Bean
    @Primary
    LocalContainerEntityManagerFactoryBean entityManagerFactory(
            EntityManagerFactoryBuilder builder, @Qualifier("dataSource") DataSource pool,
            JpaProperties jpa, HibernateProperties hibernate
    ) {
        return criarEntityManagerFactory(builder, pool, jpa, hibernate, "operacional");
    }

    @Bean
    @Primary
    JpaTransactionManager transactionManager(@Qualifier("entityManagerFactory") EntityManagerFactory factory) {
        return new JpaTransactionManager(factory);
    }

    @Configuration(proxyBeanMethods = false)
    @EnableJpaRepositories(
            basePackageClasses = VisaoColetasRepository.class,
            includeFilters = @Filter(type = FilterType.ANNOTATION, classes = ConsultaAnalitica.class),
            entityManagerFactoryRef = "entityManagerFactoryAnalitico",
            transactionManagerRef = "transactionManagerAnalitico"
    )
    static class PersistenciaAnalitica {

        @Bean
        LocalContainerEntityManagerFactoryBean entityManagerFactoryAnalitico(
                EntityManagerFactoryBuilder builder, @ConsultaAnalitica DataSource pool,
                JpaProperties jpa, HibernateProperties hibernate
        ) {
            return criarEntityManagerFactory(builder, pool, jpa, hibernate, "analitico");
        }

        @Bean
        JpaTransactionManager transactionManagerAnalitico(
                @Qualifier("entityManagerFactoryAnalitico") EntityManagerFactory factory
        ) {
            return new JpaTransactionManager(factory);
        }
    }

    private static LocalContainerEntityManagerFactoryBean criarEntityManagerFactory(
            EntityManagerFactoryBuilder builder, DataSource pool, JpaProperties jpa,
            HibernateProperties hibernate, String unidade
    ) {
        return builder.dataSource(pool)
                .packages(VisaoColetasEntity.class)
                .persistenceUnit(unidade)
                .properties(hibernate.determineHibernateProperties(jpa.getProperties(), new HibernateSettings()))
                .build();
    }
}
