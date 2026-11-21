package com.dashboard.api.controller;

import com.dashboard.api.dto.redecredenciada.RedeCredenciadaCustosDTO;
import com.dashboard.api.repository.RedeCredenciadaCustosRepository;
import java.time.LocalDate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/rede-credenciada")
@PreAuthorize("@acessoSeguranca.podeAcessar('redeCredenciada')")
public class RedeCredenciadaCustosController {
    private final RedeCredenciadaCustosRepository custos;

    public RedeCredenciadaCustosController(RedeCredenciadaCustosRepository custos) {
        this.custos = custos;
    }

    @GetMapping("/custos")
    public RedeCredenciadaCustosDTO consultar(@RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim, @RequestParam MultiValueMap<String, String> parametros) {
        return custos.consultar(dataInicio, dataFim, parametros.get("parceiros"), parametros.get("status"));
    }
}
