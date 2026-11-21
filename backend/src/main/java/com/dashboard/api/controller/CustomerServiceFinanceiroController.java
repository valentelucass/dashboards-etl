package com.dashboard.api.controller;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceFinanceiroDTO;
import com.dashboard.api.repository.CustomerServiceFinanceiroRepository;
import com.dashboard.api.service.CustomerServiceClientesService;
import com.dashboard.api.service.ValidadorPeriodoService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/customer-service")
@PreAuthorize("@acessoSeguranca.podeAcessar('customerService')")
public class CustomerServiceFinanceiroController {
    private final CustomerServiceClientesService clientes;
    private final CustomerServiceFinanceiroRepository financeiro;
    private final ValidadorPeriodoService periodo;

    public CustomerServiceFinanceiroController(CustomerServiceClientesService clientes,
            CustomerServiceFinanceiroRepository financeiro, ValidadorPeriodoService periodo) {
        this.clientes = clientes;
        this.financeiro = financeiro;
        this.periodo = periodo;
    }

    @GetMapping("/financeiro")
    public CustomerServiceFinanceiroDTO financeiro(@RequestParam List<Long> clienteId,
            @RequestParam LocalDate dataInicio, @RequestParam LocalDate dataFim) {
        var conta = clientes.exigirCliente(clienteId);
        periodo.validar(dataInicio, dataFim);
        var hoje = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        var corte = dataFim.isBefore(hoje) ? dataFim : hoje;
        return financeiro.consultar(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()), conta.documentos(), corte);
    }
}
