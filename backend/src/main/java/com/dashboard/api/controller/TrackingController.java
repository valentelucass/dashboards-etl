package com.dashboard.api.controller;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.dto.tracking.TrackingChartsDTO;
import com.dashboard.api.dto.tracking.TrackingFreteDTO;
import com.dashboard.api.dto.tracking.TrackingRegiaoDTO;
import com.dashboard.api.dto.tracking.TrackingDashboardDTO;
import com.dashboard.api.dto.tracking.TrackingOverviewDTO;
import com.dashboard.api.dto.tracking.TrackingResumoDTO;
import com.dashboard.api.dto.tracking.TrackingTimelinePointDTO;
import com.dashboard.api.service.DashboardTabelaPaginadaService;
import com.dashboard.api.service.TrackingService;
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
@RequestMapping("/api/painel/tracking")
@PreAuthorize("@acessoSeguranca.podeAcessar('tracking')")
public class TrackingController {

    private static final Logger log = LoggerFactory.getLogger(TrackingController.class);
    private final TrackingService trackingService;
    private final DashboardTabelaPaginadaService tabelaPaginadaService;

    public TrackingController(TrackingService trackingService, DashboardTabelaPaginadaService tabelaPaginadaService) {
        this.trackingService = trackingService;
        this.tabelaPaginadaService = tabelaPaginadaService;
    }

    @GetMapping
    public ResponseEntity<TrackingOverviewDTO> overview(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        log.info("GET /api/painel/tracking - periodo: {} a {}", dataInicio, dataFim);
        return ResponseEntity.ok(trackingService.buscarOverview(filtro));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<TrackingDashboardDTO> dashboard(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(trackingService.buscarDashboard(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/serie")
    public ResponseEntity<List<TrackingTimelinePointDTO>> serie(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(trackingService.buscarSerie(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/graficos")
    public ResponseEntity<TrackingChartsDTO> graficos(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(trackingService.buscarGraficos(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/tabela")
    public ResponseEntity<List<TrackingResumoDTO>> tabela(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "100") int limite,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(trackingService.buscarTabela(FiltroRequestMapper.from(dataInicio, dataFim, params), limite));
    }

    @GetMapping("/regioes")
    public ResponseEntity<PaginaDTO<TrackingRegiaoDTO>> regioes(
            @RequestParam LocalDate dataInicio, @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int size,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(trackingService.buscarRegioes(FiltroRequestMapper.from(dataInicio, dataFim, params), page, size));
    }

    @GetMapping("/fretes")
    public ResponseEntity<PaginaDTO<TrackingFreteDTO>> fretes(
            @RequestParam LocalDate dataInicio, @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int size,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(trackingService.buscarFretes(FiltroRequestMapper.from(dataInicio, dataFim, params), page, size));
    }

    @GetMapping("/detalhes")
    public ResponseEntity<PaginaDTO<TrackingResumoDTO>> detalhes(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam MultiValueMap<String, String> params) {
        FiltroConsultaDTO filtroObrigatorio = trackingService.normalizarFiltroComFilialAtualObrigatoria(
                FiltroRequestMapper.from(dataInicio, dataFim, params)
        );
        return ResponseEntity.ok(tabelaPaginadaService.buscarTracking(filtroObrigatorio, page, size));
    }
}
