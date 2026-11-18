package com.dashboard.api.controller;

import com.dashboard.api.dto.dimensoes.DimensaoOpcaoDTO;
import com.dashboard.api.dto.dimensoes.PagadorDimDTO;
import com.dashboard.api.dto.dimensoes.PlanoContasDimDTO;
import com.dashboard.api.dto.dimensoes.UsuarioDimDTO;
import com.dashboard.api.dto.dimensoes.VeiculoDimDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.DashboardExportService;
import com.dashboard.api.service.DimensoesService;
import com.dashboard.api.service.PerformanceDashboardService;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dimensoes")
public class DimensoesController {

    private static final Logger log = LoggerFactory.getLogger(DimensoesController.class);

    private final DimensoesService dimensoesService;
    private final DashboardExportService dashboardExportService;
    private final PerformanceDashboardService performanceDashboardService;

    public DimensoesController(
            DimensoesService dimensoesService,
            DashboardExportService dashboardExportService,
            PerformanceDashboardService performanceDashboardService
    ) {
        this.dimensoesService = dimensoesService;
        this.dashboardExportService = dashboardExportService;
        this.performanceDashboardService = performanceDashboardService;
    }

    @GetMapping("/filiais")
    @PreAuthorize("@acessoSeguranca.podeAcessarDimensaoFiliais()")
    public List<String> filiais() {
        log.info("GET /api/dimensoes/filiais");
        return dimensoesService.listarFiliais();
    }

    @GetMapping("/clientes")
    @PreAuthorize("@acessoSeguranca.podeAcessarDimensaoClientes()")
    public List<String> clientes() {
        log.info("GET /api/dimensoes/clientes");
        return dimensoesService.listarClientes();
    }

    @GetMapping("/pagadores")
    @PreAuthorize("@acessoSeguranca.podeAcessar('performance')")
    public List<PagadorDimDTO> pagadores(
            @RequestParam(required = false) String busca,
            @RequestParam(defaultValue = "50") int limite
    ) {
        log.info("GET /api/dimensoes/pagadores - busca: {}", busca);
        return dimensoesService.buscarPagadores(busca, limite);
    }

    @GetMapping("/faturas-por-cliente/pagadores")
    @PreAuthorize("@acessoSeguranca.podeAcessar('faturasPorCliente')")
    public List<String> faturasPorClientePagadores() {
        return dimensoesService.listarPagadoresFaturasPorCliente();
    }

    @GetMapping("/faturas-por-cliente/clientes-cnpj")
    @PreAuthorize("@acessoSeguranca.podeAcessar('faturasPorCliente')")
    public List<String> faturasPorClienteClientesCnpj() {
        log.info("GET /api/dimensoes/faturas-por-cliente/clientes-cnpj");
        return dimensoesService.listarClientesCnpjFaturasPorCliente();
    }

    @GetMapping("/motoristas")
    @PreAuthorize("@acessoSeguranca.podeAcessarDimensaoMotoristas()")
    public List<String> motoristas() {
        log.info("GET /api/dimensoes/motoristas");
        return dimensoesService.listarMotoristas();
    }

    @GetMapping("/veiculos")
    @PreAuthorize("@acessoSeguranca.podeAcessarDimensaoVeiculos()")
    public List<VeiculoDimDTO> veiculos() {
        log.info("GET /api/dimensoes/veiculos");
        return dimensoesService.listarVeiculos();
    }

    @GetMapping("/planocontas")
    @PreAuthorize("@acessoSeguranca.podeAcessarDimensaoPlanoContas()")
    public List<PlanoContasDimDTO> planoContas() {
        log.info("GET /api/dimensoes/planocontas");
        return dimensoesService.listarPlanoContas();
    }

    @GetMapping("/usuarios")
    @PreAuthorize("@acessoSeguranca.podeAcessarDimensaoUsuarios()")
    public List<UsuarioDimDTO> usuarios() {
        log.info("GET /api/dimensoes/usuarios");
        return dimensoesService.listarUsuarios();
    }

    @GetMapping("/performance/responsaveis")
    @PreAuthorize("@acessoSeguranca.podeAcessar('performance')")
    public List<DimensaoOpcaoDTO> performanceResponsaveis(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/performance/responsaveis - periodo: {} a {}", dataInicio, dataFim);
        return performanceDashboardService.listarResponsaveis(FiltroRequestMapper.from(dataInicio, dataFim, params));
    }

    @GetMapping("/performance/regioes-destino")
    @PreAuthorize("@acessoSeguranca.podeAcessar('performance')")
    public List<String> performanceRegioesDestino(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/performance/regioes-destino - periodo: {} a {}", dataInicio, dataFim);
        return performanceDashboardService.listarRegioesDestino(FiltroRequestMapper.from(dataInicio, dataFim, params));
    }

    @GetMapping("/performance/cidades-destino")
    @PreAuthorize("@acessoSeguranca.podeAcessar('performance')")
    public List<String> performanceCidadesDestino(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/performance/cidades-destino - periodo: {} a {}", dataInicio, dataFim);
        return performanceDashboardService.listarCidadesDestino(FiltroRequestMapper.from(dataInicio, dataFim, params));
    }

    @GetMapping("/faturamento/responsaveis")
    @PreAuthorize("@acessoSeguranca.podeAcessar('fretes')")
    public List<DimensaoOpcaoDTO> faturamentoResponsaveis(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/faturamento/responsaveis - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarResponsaveisFretes(filtro);
    }

    @GetMapping("/cotacoes/usuarios")
    @PreAuthorize("@acessoSeguranca.podeAcessar('cotacoes')")
    public List<DimensaoOpcaoDTO> cotacoesUsuarios(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/cotacoes/usuarios - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarUsuariosCotacoes(filtro);
    }

    @GetMapping("/cotacoes/classificacoes")
    @PreAuthorize("@acessoSeguranca.podeAcessar('cotacoes')")
    public List<DimensaoOpcaoDTO> cotacoesClassificacoes(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/cotacoes/classificacoes - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarClassificacoesCotacoes(filtro);
    }

    @GetMapping("/cotacoes/origens")
    @PreAuthorize("@acessoSeguranca.podeAcessar('cotacoes')")
    public List<DimensaoOpcaoDTO> cotacoesOrigens(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/cotacoes/origens - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarOrigensCotacoes(filtro);
    }

    @GetMapping("/cotacoes/destinos")
    @PreAuthorize("@acessoSeguranca.podeAcessar('cotacoes')")
    public List<DimensaoOpcaoDTO> cotacoesDestinos(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/cotacoes/destinos - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarDestinosCotacoes(filtro);
    }

    @GetMapping("/manifestos/classificacoes")
    @PreAuthorize("@acessoSeguranca.podeAcessar('manifestos')")
    public List<String> manifestosClassificacoes(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/manifestos/classificacoes - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarClassificacoesManifestos(filtro);
    }

    @GetMapping("/fretes/status")
    @PreAuthorize("@acessoSeguranca.podeAcessar('fretes')")
    public List<String> fretesStatus(
            @RequestParam LocalDate dataInicio,
            @RequestParam LocalDate dataFim,
            @RequestParam MultiValueMap<String, String> params
    ) {
        log.info("GET /api/dimensoes/fretes/status - periodo: {} a {}", dataInicio, dataFim);
        FiltroConsultaDTO filtro = FiltroRequestMapper.from(dataInicio, dataFim, params);
        return dashboardExportService.listarStatusFretes(filtro);
    }
}
