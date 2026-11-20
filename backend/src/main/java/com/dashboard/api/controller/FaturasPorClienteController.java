package com.dashboard.api.controller;

import com.dashboard.api.dto.faturascliente.FaturaPorClienteResumoDTO;
import com.dashboard.api.dto.faturascliente.ClienteEmAtrasoDTO;
import com.dashboard.api.dto.faturascliente.EvolucaoFretesRecebiveisDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteAgingBucketDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteDrilldownPointDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteMensalDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteOverviewDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteSerieDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusEvolucaoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusProcessoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteTopClienteDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.DashboardTabelaPaginadaService;
import com.dashboard.api.service.FaturasPorClienteService;
import com.dashboard.api.util.ConsultaLimiteUtils;
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
@RequestMapping("/api/painel/faturas-por-cliente")
@PreAuthorize("@acessoSeguranca.podeAcessar('faturasPorCliente')")
public class FaturasPorClienteController {

    private static final Logger log = LoggerFactory.getLogger(FaturasPorClienteController.class);
    private final FaturasPorClienteService service;
    private final DashboardTabelaPaginadaService tabelaPaginadaService;

    public FaturasPorClienteController(
            FaturasPorClienteService service,
            DashboardTabelaPaginadaService tabelaPaginadaService
    ) {
        this.service = service;
        this.tabelaPaginadaService = tabelaPaginadaService;
    }

    @GetMapping
    public ResponseEntity<FaturasPorClienteOverviewDTO> overview(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        log.info("GET /api/painel/faturas-por-cliente - periodo: {} a {}", dataInicio, dataFim);
        return ResponseEntity.ok(service.buscarOverview(filtro));
    }

    @GetMapping("/mensal")
    public ResponseEntity<List<FaturasPorClienteMensalDTO>> mensal(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarMensal(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/serie")
    public ResponseEntity<List<FaturasPorClienteSerieDTO>> serie(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "mes") String granularidade,
            @RequestParam(defaultValue = "emissao") String referencia,
            @RequestParam(defaultValue = "valor_faturado") String metrica,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarSerie(
                FiltroRequestMapper.from(dataInicio, dataFim, params), granularidade, referencia, metrica));
    }

    @GetMapping("/aging")
    public ResponseEntity<List<FaturasPorClienteAgingBucketDTO>> aging(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "todos") String escopo,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarAging(FiltroRequestMapper.from(dataInicio, dataFim, params), escopo));
    }

    @GetMapping("/aging/drilldown")
    public ResponseEntity<List<FaturasPorClienteDrilldownPointDTO>> agingDrilldown(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam String faixa,
            @RequestParam(defaultValue = "cliente") String nivel,
            @RequestParam(required = false) String cliente,
            @RequestParam(defaultValue = "10") int limite,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarDrilldownAging(
                FiltroRequestMapper.from(dataInicio, dataFim, params), faixa, nivel, cliente, limite));
    }

    @GetMapping("/clientes-em-atraso")
    public ResponseEntity<List<ClienteEmAtrasoDTO>> clientesEmAtraso(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarClientesEmAtraso(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/evolucao-fretes")
    public ResponseEntity<List<EvolucaoFretesRecebiveisDTO>> evolucaoFretes(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "mes") String granularidade,
            @RequestParam(defaultValue = "emissao") String referencia,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarEvolucaoFretes(
                FiltroRequestMapper.from(dataInicio, dataFim, params), granularidade, referencia));
    }

    @GetMapping("/top-clientes")
    public ResponseEntity<List<FaturasPorClienteTopClienteDTO>> topClientes(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "10") int limite,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarTopClientes(FiltroRequestMapper.from(dataInicio, dataFim, params), limite));
    }

    @GetMapping("/top-clientes/drilldown")
    public ResponseEntity<List<FaturasPorClienteDrilldownPointDTO>> topClientesDrilldown(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "10") int limite,
            @RequestParam(defaultValue = "valor_faturado") String metrica,
            @RequestParam(defaultValue = "cliente") String nivel,
            @RequestParam(required = false) String cliente,
            @RequestParam(required = false) String cnpj,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarDrilldownClientes(
                FiltroRequestMapper.from(dataInicio, dataFim, params), limite, metrica, nivel, cliente, cnpj));
    }

    @GetMapping("/status-processo")
    public ResponseEntity<List<FaturasPorClienteStatusProcessoDTO>> statusProcesso(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarStatusProcesso(FiltroRequestMapper.from(dataInicio, dataFim, params)));
    }

    @GetMapping("/status-processo/evolucao")
    public ResponseEntity<List<FaturasPorClienteStatusEvolucaoDTO>> evolucaoStatusProcesso(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "dia") String granularidade,
            @RequestParam MultiValueMap<String, String> params) {
        return ResponseEntity.ok(service.buscarEvolucaoStatus(
                FiltroRequestMapper.from(dataInicio, dataFim, params), granularidade));
    }

    @GetMapping("/tabela")
    public ResponseEntity<List<FaturaPorClienteResumoDTO>> tabela(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam(defaultValue = "100") int limite,
            @RequestParam MultiValueMap<String, String> params) {
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        int limiteAplicado = ConsultaLimiteUtils.limitar(limite, 100, 100);
        return ResponseEntity.ok(tabelaPaginadaService.buscarFaturasPorCliente(filtro, 1, limiteAplicado).conteudo());
    }
}
