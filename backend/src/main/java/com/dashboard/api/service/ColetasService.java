package com.dashboard.api.service;

import com.dashboard.api.contract.ColetasViewContractValidator;
import com.dashboard.api.dto.coletas.ColetaResumoDTO;
import com.dashboard.api.dto.coletas.ColetasAgingBucketDTO;
import com.dashboard.api.dto.coletas.ColetasChartsDTO;
import com.dashboard.api.dto.coletas.ColetasCidadeOrigemDTO;
import com.dashboard.api.dto.coletas.ColetasHistoricoPerformanceDTO;
import com.dashboard.api.dto.coletas.ColetasHistoricoPeriodo;
import com.dashboard.api.dto.coletas.ColetasOverviewDTO;
import com.dashboard.api.dto.coletas.ColetasOperacaoDTO;
import com.dashboard.api.dto.coletas.ColetasRegiaoOrigemDTO;
import com.dashboard.api.dto.coletas.ColetasStatusDistribuicaoDTO;
import com.dashboard.api.dto.coletas.ColetasTrendPointDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.repository.ColetasAgregadosSqlRepository;
import com.dashboard.api.util.ConsultaLimiteUtils;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class ColetasService {

    private final ValidadorPeriodoService validadorPeriodo;
    private final PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper;
    private final ColetasAgregadosSqlRepository agregadosSqlRepository;
    private final ColetasViewContractValidator contractValidator;
    private final DashboardTabelaPaginadaService tabelaPaginadaService;

    public ColetasService(
            ValidadorPeriodoService validadorPeriodo,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper,
            ColetasAgregadosSqlRepository agregadosSqlRepository,
            ColetasViewContractValidator contractValidator,
            DashboardTabelaPaginadaService tabelaPaginadaService
    ) {
        this.validadorPeriodo = validadorPeriodo;
        this.periodoOffsetDateTimeHelper = periodoOffsetDateTimeHelper;
        this.agregadosSqlRepository = agregadosSqlRepository;
        this.contractValidator = contractValidator;
        this.tabelaPaginadaService = tabelaPaginadaService;
    }

    public ColetasOverviewDTO buscarOverview(LocalDate dataInicio, LocalDate dataFim) {
        return buscarOverview(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()));
    }

    public ColetasOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return agregadosSqlRepository.buscarOverview(filtro);
    }

    public List<ColetasTrendPointDTO> buscarSerieTemporal(LocalDate dataInicio, LocalDate dataFim) {
        return buscarSerieTemporal(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()));
    }

    public List<ColetasTrendPointDTO> buscarSerieTemporal(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return agregadosSqlRepository.buscarSerieTemporal(filtro);
    }

    public List<ColetaResumoDTO> buscarTabela(FiltroConsultaDTO filtro, int limite) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        contractValidator.validarSolicitacaoNativa();
        int limiteAplicado = ConsultaLimiteUtils.limitar(limite, 100, 200);
        return tabelaPaginadaService.buscarPrimeiraPaginaColetas(filtro, limiteAplicado);
    }

    public ColetasChartsDTO buscarGraficos(FiltroConsultaDTO filtro) {
        List<ColetasStatusDistribuicaoDTO> status = buscarStatusDistribuicao(filtro);
        ColetasOperacaoDTO operacao = buscarOperacao(filtro);
        return new ColetasChartsDTO(status, List.of(), operacao.regioesOrigem(), operacao.agingAbertas());
    }

    public List<ColetasStatusDistribuicaoDTO> buscarStatusDistribuicao(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        contractValidator.validarSolicitacaoNativa();
        return agregadosSqlRepository.buscarStatusDistribuicao(filtro);
    }

    public ColetasOperacaoDTO buscarOperacao(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        contractValidator.validarSolicitacaoNativa();

        List<ColetasRegiaoOrigemDTO> regioesOrigem = agregadosSqlRepository.buscarRegioesOrigem(filtro);
        List<ColetasAgingBucketDTO> agingAbertas = agregadosSqlRepository.buscarAgingAbertas(
                filtro,
                periodoOffsetDateTimeHelper.hoje()
        );

        return new ColetasOperacaoDTO(regioesOrigem, agingAbertas);
    }

    public List<ColetasHistoricoPerformanceDTO> buscarHistoricoPerformance(FiltroConsultaDTO filtro, String periodo) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        contractValidator.validarSolicitacaoNativa();

        ColetasHistoricoPeriodo periodoHistorico = ColetasHistoricoPeriodo.from(periodo);
        LocalDate dataReferencia = periodoOffsetDateTimeHelper.hoje();
        LocalDate historicoDataInicio = periodoHistorico.usaJanelaRelativa()
                ? periodoHistorico.inicioJanela(dataReferencia)
                : filtro.dataInicio();
        LocalDate historicoDataFim = periodoHistorico.usaJanelaRelativa()
                ? dataReferencia
                : filtro.dataFim();

        return agregadosSqlRepository.buscarHistoricoPerformance(
                filtro,
                periodoHistorico,
                historicoDataInicio,
                historicoDataFim
        );
    }

    public List<ColetasCidadeOrigemDTO> buscarCidadesPorRegiao(FiltroConsultaDTO filtro, String regiaoLogistica) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        contractValidator.validarSolicitacaoNativa();

        if (!temTexto(regiaoLogistica)) {
            return List.of();
        }

        return agregadosSqlRepository.buscarCidadesOrigem(filtro, regiaoLogistica.trim());
    }

    private boolean temTexto(String valor) {
        return valor != null && !valor.isBlank();
    }

}
