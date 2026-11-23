package com.dashboard.api.controller;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.EficienciaFilial;
import com.dashboard.api.service.PerformanceDashboardService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/rede-credenciada")
@PreAuthorize("@acessoSeguranca.podeAcessar('redeCredenciada')")
public class RedeCredenciadaDesempenhoController {
    private final PerformanceDashboardService performance;

    public RedeCredenciadaDesempenhoController(PerformanceDashboardService performance) {
        this.performance = performance;
    }

    @GetMapping("/desempenho")
    public List<Desempenho> desempenho(@RequestParam LocalDate dataInicio, @RequestParam LocalDate dataFim) {
        return performance.eficienciaDaRede(new FiltroConsultaDTO(dataInicio, dataFim, Map.of())).stream()
                .map(Desempenho::daFilial)
                .toList();
    }

    public record Desempenho(String filial, Double otif, Double efd, long otifNoPrazo, long otifTotal,
                             long efdEficientes, long efdTotal) {
        static Desempenho daFilial(EficienciaFilial linha) {
            return new Desempenho(linha.filial(), linha.otif(), linha.efd(), linha.otifNoPrazo(),
                    linha.otifTotal(), linha.efdEficientes(), linha.efdTotal());
        }
    }
}
