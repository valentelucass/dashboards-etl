package com.dashboard.api.controller;

import com.dashboard.api.dto.coletas.ColetaResumoDTO;
import com.dashboard.api.dto.coletas.ColetasChartsDTO;
import com.dashboard.api.dto.coletas.ColetasCidadeOrigemDTO;
import com.dashboard.api.dto.coletas.ColetasHistoricoPerformanceDTO;
import com.dashboard.api.dto.coletas.ColetasOverviewDTO;
import com.dashboard.api.dto.coletas.ColetasOperacaoDTO;
import com.dashboard.api.dto.coletas.ColetasStatusDistribuicaoDTO;
import com.dashboard.api.dto.coletas.ColetasTrendPointDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.ColetasService;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/coletas")
@PreAuthorize("@acessoSeguranca.podeAcessar('coletas')")
public class ColetasController {

    private static final Logger log = LoggerFactory.getLogger(ColetasController.class);
    private final ColetasService coletasService;

    public ColetasController(ColetasService coletasService) {
        this.coletasService = coletasService;
    }

    @GetMapping
    public ResponseEntity<ColetasOverviewDTO> overview(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        log.info("GET /api/painel/coletas - periodo: {} a {}", dataInicio, dataFim);
        return ResponseEntity.ok(coletasService.buscarOverview(filtro));
    }

    @GetMapping("/serie")
    public ResponseEntity<List<ColetasTrendPointDTO>> serie(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarSerieTemporal(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/graficos")
    public ResponseEntity<ColetasChartsDTO> graficos(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarGraficos(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/graficos/status")
    public ResponseEntity<List<ColetasStatusDistribuicaoDTO>> status(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarStatusDistribuicao(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/graficos/operacao")
    public ResponseEntity<ColetasOperacaoDTO> operacao(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarOperacao(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/graficos/historico-performance")
    public ResponseEntity<List<ColetasHistoricoPerformanceDTO>> historicoPerformance(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "dias") String periodo,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarHistoricoPerformance(
                FiltroRequestMapper.from(dataInicio, dataFim, params),
                periodo
        ));
    }

    @GetMapping("/graficos/cidades")
    public ResponseEntity<List<ColetasCidadeOrigemDTO>> cidadesPorRegiao(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(required = false) String regiaoLogistica,
            @RequestParam(required = false) String regiao,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarCidadesPorRegiao(
                FiltroRequestMapper.from(dataInicio, dataFim, params),
                temTexto(regiaoLogistica) ? regiaoLogistica : regiao
        ));
    }

    @GetMapping("/tabela")
    public ResponseEntity<List<ColetaResumoDTO>> tabela(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "100") int limite,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(coletasService.buscarTabela(FiltroRequestMapper.from(dataInicio, dataFim, params), limite));
    }

    private boolean temTexto(String valor) {
        return valor != null && !valor.isBlank();
    }
}
