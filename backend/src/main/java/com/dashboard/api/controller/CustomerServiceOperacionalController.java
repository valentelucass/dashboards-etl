package com.dashboard.api.controller;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceOperacionalDTO;
import com.dashboard.api.repository.CustomerServiceOperacionalRepository;
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
public class CustomerServiceOperacionalController {
    private final CustomerServiceClientesService clientes;
    private final CustomerServiceOperacionalRepository operacional;
    private final ValidadorPeriodoService periodo;

    public CustomerServiceOperacionalController(CustomerServiceClientesService clientes,
            CustomerServiceOperacionalRepository operacional, ValidadorPeriodoService periodo) {
        this.clientes = clientes;
        this.operacional = operacional;
        this.periodo = periodo;
    }

    @GetMapping("/operacional")
    public CustomerServiceOperacionalDTO consultar(@RequestParam List<Long> clienteId,
            @RequestParam LocalDate dataInicio, @RequestParam LocalDate dataFim) {
        periodo.validar(dataInicio, dataFim);
        var cliente = clientes.exigirCliente(clienteId);
        var hoje = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        return operacional.consultar(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()), cliente,
                dataFim.isBefore(hoje) ? dataFim : hoje);
    }
}
