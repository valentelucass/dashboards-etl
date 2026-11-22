package com.dashboard.api.service;

import com.dashboard.api.dto.customerservice.CustomerServiceContaDTO.Opcao;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomerServiceClientesServiceTest {
    private final EscopoFilialService escopo = mock(EscopoFilialService.class);
    private CustomerServiceClientesService clientes;

    @BeforeEach void preparar() {
        var fonte = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        var jdbc = new JdbcTemplate(fonte);
        jdbc.execute("CREATE SCHEMA acesso");
        jdbc.execute("CREATE TABLE acesso.customer_service_contas(id bigint primary key, nome varchar(200), ativa bit)");
        jdbc.execute("CREATE TABLE acesso.customer_service_documentos(conta_id bigint, documento varchar(14) primary key, ativo bit)");
        jdbc.update("INSERT INTO acesso.customer_service_contas VALUES (1,'Alfa',1),(2,'Alfa',1),(3,'Antiga',0),(4,'Sem documentos',1)");
        jdbc.update("INSERT INTO acesso.customer_service_documentos VALUES (1,'00000000000101',1),(1,'00000000000201',1),(2,'00000000000301',1),(3,'00000000000401',1),(1,'00000000000501',0),(4,'00000000000601',0)");
        when(escopo.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.comAcessoTotal());
        clientes = new CustomerServiceClientesService(jdbc, escopo);
    }

    @Test void separaContasHomonimasEListaSoCnpjsAutorizados() {
        assertEquals(List.of(new Opcao(1,"Alfa"), new Opcao(2,"Alfa")), clientes.listar());
        assertEquals(List.of("00000000000101","00000000000201"), clientes.exigirCliente(List.of(1L)).documentos());
        assertEquals(List.of("00000000000301"), clientes.exigirCliente(List.of(2L)).documentos());
        for (long id : List.of(3L, 4L, 999L)) {
            var e = assertThrows(ResponseStatusException.class, () -> clientes.exigirCliente(List.of(id)));
            assertEquals(HttpStatus.NOT_FOUND, e.getStatusCode());
        }
    }

    @Test void recusaConsultaSemUmClienteOuSemFilialPermitida() {
        for (var ids : List.of(List.<Long>of(), List.of(1L,2L), List.of(1L,1L), List.of(0L))) {
            var e = assertThrows(ResponseStatusException.class, () -> clientes.exigirCliente(ids));
            assertEquals(HttpStatus.BAD_REQUEST, e.getStatusCode());
        }
        when(escopo.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.semAcesso());
        assertTrue(clientes.listar().isEmpty());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> clientes.exigirCliente(List.of(1L))).getStatusCode());
    }
}
