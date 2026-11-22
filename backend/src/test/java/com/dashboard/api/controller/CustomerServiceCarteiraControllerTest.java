package com.dashboard.api.controller;

import com.dashboard.api.security.AcessoSeguranca;
import com.dashboard.api.security.PermissaoCatalogo;
import com.dashboard.api.service.CustomerServiceCarteiraService;
import com.dashboard.api.util.CustomerServiceCarteiraExcel;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@SpringJUnitConfig(CustomerServiceCarteiraControllerTest.Config.class)
class CustomerServiceCarteiraControllerTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean AcessoSeguranca acessoSeguranca() { return new AcessoSeguranca(); }
        @Bean CustomerServiceCarteiraController controller() {
            return new CustomerServiceCarteiraController(new CustomerServiceCarteiraExcel(),
                    mock(CustomerServiceCarteiraService.class));
        }
    }

    @Autowired CustomerServiceCarteiraController controller;

    @AfterEach void limpar() { SecurityContextHolder.clearContext(); }

    @Test void somenteGestaoGlobalComAcessoAoCsPodeBaixarConferirESubstituir() {
        var permissao = PermissaoCatalogo.authorityForKey("customerService");
        for (String[] papeis : new String[][]{{permissao}, {"ROLE_ADMIN", permissao},
                {"ROLE_ADMIN_SETOR", permissao}, {"ROLE_ADMIN_PLATAFORMA"}}) {
            autenticar(papeis);
            assertThrows(AccessDeniedException.class, () -> controller.modelo());
            assertThrows(AccessDeniedException.class, () -> controller.previa(null, "2026-11"));
            assertThrows(AccessDeniedException.class, () -> controller.aplicar(null, "2026-11", 0, "", () -> "admin"));
        }
        for (String papel : new String[]{"ROLE_ADMIN_PLATAFORMA", "ROLE_DESENVOLVEDOR"}) {
            autenticar(papel, permissao);
            assertEquals(200, controller.modelo().getStatusCode().value());
        }
    }

    private void autenticar(String... papeis) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin", null, AuthorityUtils.createAuthorityList(papeis)));
    }
}
