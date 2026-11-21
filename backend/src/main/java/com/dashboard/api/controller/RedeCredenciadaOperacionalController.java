package com.dashboard.api.controller;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.redecredenciada.RedeCredenciadaOperacionalDTO;
import com.dashboard.api.repository.ColetasAgregadosSqlRepository;
import com.dashboard.api.repository.ComprovantesArquivadosRepository;
import com.dashboard.api.repository.RedeCredenciadaOperacionalRepository;
import com.dashboard.api.service.ValidadorPeriodoService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/rede-credenciada")
@PreAuthorize("@acessoSeguranca.podeAcessar('redeCredenciada')")
public class RedeCredenciadaOperacionalController {
    private final RedeCredenciadaOperacionalRepository rede;
    private final ColetasAgregadosSqlRepository coletas;
    private final ComprovantesArquivadosRepository comprovantes;
    private final ValidadorPeriodoService periodo;

    public RedeCredenciadaOperacionalController(RedeCredenciadaOperacionalRepository rede,
            ColetasAgregadosSqlRepository coletas, ComprovantesArquivadosRepository comprovantes,
            ValidadorPeriodoService periodo) {
        this.rede = rede;
        this.coletas = coletas;
        this.comprovantes = comprovantes;
        this.periodo = periodo;
    }

    @GetMapping("/operacional")
    public RedeCredenciadaOperacionalDTO operacional(@RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim, @RequestParam(required = false) String parceiro) {
        periodo.validar(dataInicio, dataFim);
        var filtro = new FiltroConsultaDTO(dataInicio, dataFim, Map.of());
        var cobertura = comprovantes.coberturaArquivos(dataInicio, dataFim);
        return new RedeCredenciadaOperacionalDTO(dataInicio, dataFim, cobertura,
                rede.entregas(filtro, parceiro, cobertura.completa()), coletas.desempenhoDiarioDaRede(filtro, parceiro));
    }
}
