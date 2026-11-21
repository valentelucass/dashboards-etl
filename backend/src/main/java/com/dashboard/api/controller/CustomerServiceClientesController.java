package com.dashboard.api.controller;

import com.dashboard.api.dto.customerservice.CustomerServiceContaDTO.Opcao;
import com.dashboard.api.service.CustomerServiceClientesService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/customer-service")
@PreAuthorize("@acessoSeguranca.podeAcessar('customerService')")
public class CustomerServiceClientesController {
    private final CustomerServiceClientesService clientes;

    public CustomerServiceClientesController(CustomerServiceClientesService clientes) {
        this.clientes = clientes;
    }

    @GetMapping("/clientes")
    public List<Opcao> listar() {
        return clientes.listar();
    }
}
