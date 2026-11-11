package com.dashboard.api.controller;

import com.dashboard.api.dto.etl.EtlV2CoberturaDTO;
import com.dashboard.api.service.EtlV2CoberturaService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EtlV2CoberturaController {

    private final EtlV2CoberturaService service;

    public EtlV2CoberturaController(EtlV2CoberturaService service) {
        this.service = service;
    }

    @GetMapping("/api/painel/etl-saude/cobertura-v2")
    @PreAuthorize("@acessoSeguranca.podeAcessar('etlSaude') && @acessoSeguranca.ehAdminPlataformaOuDesenvolvedor()")
    public List<EtlV2CoberturaDTO> consultar() {
        return service.consultar();
    }
}
