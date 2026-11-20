package com.dashboard.api.controller;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.dto.performance.PerformanceAgingPointDTO;
import com.dashboard.api.dto.performance.PerformanceDrilldownPointDTO;
import com.dashboard.api.dto.performance.PerformanceEntregaRowDTO;
import com.dashboard.api.dto.performance.PerformanceHistoricoPointDTO;
import com.dashboard.api.dto.performance.PerformanceOverviewDTO;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.EficienciaFilial;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.EntregaAtencao;
import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.OcorrenciaAtraso;
import com.dashboard.api.dto.performance.PerformanceSerieTemporalPointDTO;
import com.dashboard.api.dto.performance.PerformanceStatusDistribuicaoDTO;
import com.dashboard.api.dto.performance.PerformanceTabelaProjection;
import com.dashboard.api.service.DashboardExportService;
import com.dashboard.api.service.PerformanceDashboardService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/painel/performance")
@PreAuthorize("@acessoSeguranca.podeAcessar('performance')")
public class PerformanceController {

    private final PerformanceDashboardService service;
    private final DashboardExportService dashboardExportService;

    public PerformanceController(
            PerformanceDashboardService service,
            DashboardExportService dashboardExportService
    ) {
        this.service = service;
        this.dashboardExportService = dashboardExportService;
    }

    @GetMapping("/overview")
    public ResponseEntity<PerformanceOverviewDTO> overview(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarOverview(filtro(dataInicio, dataFim, params, pagadores)));
    }

    @GetMapping("/ocorrencias-atraso")
    public ResponseEntity<List<OcorrenciaAtraso>> ocorrenciasAtraso(@RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim, @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.ocorrenciasAtraso(filtro(dataInicio, dataFim, params, pagadores)));
    }

    @GetMapping("/entregas-atencao")
    public ResponseEntity<PaginaDTO<EntregaAtencao>> entregasAtencao(@RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim, @RequestParam(defaultValue = "1") int pagina,
            @RequestParam(defaultValue = "10") int tamanhoPagina,
            @RequestParam(required = false) List<String> pagadores, @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.entregasAtencao(filtro(dataInicio, dataFim, params, pagadores), pagina, tamanhoPagina));
    }

    @GetMapping("/eficiencia-filiais")
    public ResponseEntity<List<EficienciaFilial>> eficienciaFiliais(@RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim, @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.eficienciaFiliais(filtro(dataInicio, dataFim, params, pagadores)));
    }

    @GetMapping("/serie-temporal")
    public ResponseEntity<List<PerformanceSerieTemporalPointDTO>> serieTemporal(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "dia") String nivel,
            @RequestParam(required = false) Integer ano,
            @RequestParam(required = false) Integer mes,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarSerieTemporal(
                filtro(dataInicio, dataFim, params, pagadores),
                nivel,
                ano,
                mes
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<List<PerformanceStatusDistribuicaoDTO>> status(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarStatus(filtro(dataInicio, dataFim, params, pagadores)));
    }

    @GetMapping("/historico")
    public ResponseEntity<List<PerformanceHistoricoPointDTO>> historico(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarHistorico(filtro(dataInicio, dataFim, params, pagadores)));
    }

    @GetMapping("/drilldown")
    public ResponseEntity<List<PerformanceDrilldownPointDTO>> drilldown(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "responsavel") String nivel,
            @RequestParam(required = false) String responsavel,
            @RequestParam(required = false) String regiaoDestino,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarDrilldown(
                filtro(dataInicio, dataFim, params, pagadores),
                nivel,
                responsavel,
                regiaoDestino
        ));
    }

    @GetMapping("/aging")
    public ResponseEntity<List<PerformanceAgingPointDTO>> aging(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarAging(filtro(dataInicio, dataFim, params, pagadores)));
    }

    @GetMapping("/tabela")
    public ResponseEntity<Page<PerformanceTabelaProjection>> tabela(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @PageableDefault(size = 10) Pageable pageable,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarTabela(
                filtro(dataInicio, dataFim, params, pagadores),
                pageable
        ));
    }

    @GetMapping("/tabela/paginada")
    public ResponseEntity<PaginaDTO<PerformanceEntregaRowDTO>> tabelaPaginada(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "1") int pagina,
            @RequestParam(defaultValue = "10") int tamanhoPagina,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        return ResponseEntity.ok(service.buscarTabelaPaginada(
                filtro(dataInicio, dataFim, params, pagadores),
                pagina,
                tamanhoPagina
        ));
    }

    @GetMapping("/exportacao")
    public ResponseEntity<StreamingResponseBody> exportar(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(required = false) List<String> pagadores,
            @RequestParam MultiValueMap<String, String> params
    ) {
        FiltroConsultaDTO filtro = filtro(dataInicio, dataFim, params, pagadores);
        return dashboardExportService.exportarBeans(
                "performance",
                filtro,
                service.buscarExportacao(filtro)
        );
    }

    private static FiltroConsultaDTO filtro(
            LocalDate dataInicio,
            LocalDate dataFim,
            MultiValueMap<String, String> params,
            List<String> pagadores
    ) {
        if (pagadores == null || pagadores.isEmpty() || params.containsKey("f.pagadores")) {
            return FiltroRequestMapper.from(dataInicio, dataFim, params);
        }

        MultiValueMap<String, String> paramsComPagadores = new LinkedMultiValueMap<>(params);
        pagadores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .forEach(valor -> paramsComPagadores.add("f.pagadores", valor));
        return FiltroRequestMapper.from(dataInicio, dataFim, paramsComPagadores);
    }
}
