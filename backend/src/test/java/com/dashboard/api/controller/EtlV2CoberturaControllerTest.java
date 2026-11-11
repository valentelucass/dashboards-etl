package com.dashboard.api.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dashboard.api.dto.etl.EtlV2CoberturaDTO;
import com.dashboard.api.repository.EtlV2CoberturaRepository;
import com.dashboard.api.security.AcessoSeguranca;
import com.dashboard.api.security.PermissaoCatalogo;
import com.dashboard.api.service.EtlV2CoberturaService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.web.server.ResponseStatusException;

@SpringJUnitConfig(EtlV2CoberturaControllerTest.Config.class)
class EtlV2CoberturaControllerTest {

    @Configuration
    @EnableMethodSecurity
    @Import({AcessoSeguranca.class, EtlV2CoberturaController.class, EtlV2CoberturaService.class})
    static class Config {
        @Bean
        EtlV2CoberturaRepository repository() {
            return mock(EtlV2CoberturaRepository.class);
        }
    }

    @Autowired
    private EtlV2CoberturaController controller;
    @Autowired
    private EtlV2CoberturaRepository repository;

    @AfterEach
    void limparSessao() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @CsvSource({"ADMIN_PLATAFORMA,false", "DESENVOLVEDOR,false", "USUARIO_COMUM,true", "ADMIN,true"})
    void recusaAgregadoGlobalSemPermissaoEPerfilOperacional(String papel, boolean permissao) {
        autenticar(papel, permissao);
        assertThatThrownBy(controller::consultar).isInstanceOf(AccessDeniedException.class);
    }

    @ParameterizedTest
    @CsvSource({"ADMIN_PLATAFORMA", "DESENVOLVEDOR"})
    void entregaCoberturaApenasAOperadorComAcesso(String papel) {
        autenticar(papel, true);
        var row = new EtlV2CoberturaDTO("COLETAS", 6908, 31, 2L, 100L,
                LocalDate.parse("2026-11-02"), LocalDate.parse("2026-11-04"),
                OffsetDateTime.parse("2026-11-10T12:00:00Z"), "AVAILABLE");
        when(repository.consultar()).thenReturn(List.of(row));
        assertThat(controller.consultar()).containsExactly(row);
    }

    @Test
    void fonteIndisponivelNaoViraContagemZeroNemExpoeDetalheSql() {
        autenticar("ADMIN_PLATAFORMA", true);
        when(repository.consultar()).thenThrow(new DataAccessResourceFailureException("private details"));
        assertThatThrownBy(controller::consultar)
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(ex.getMessage()).doesNotContain("private details");
                });
    }

    private static void autenticar(String papel, boolean permissao) {
        var authorities = new ArrayList<SimpleGrantedAuthority>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + papel));
        if (permissao) {
            authorities.add(new SimpleGrantedAuthority(PermissaoCatalogo.authorityForKey("etlSaude")));
        }
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("operador@example.invalid", null, authorities));
    }
}
