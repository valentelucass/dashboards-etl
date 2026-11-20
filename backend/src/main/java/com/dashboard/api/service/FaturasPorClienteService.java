package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.faturascliente.FaturaPorClienteResumoDTO;
import com.dashboard.api.dto.faturascliente.ClienteEmAtrasoDTO;
import com.dashboard.api.dto.faturascliente.EvolucaoFretesRecebiveisDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteAgingBucketDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteAgingEscopo;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteDrilldownNivel;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteDrilldownPointDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteGranularidade;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteMensalDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteMetrica;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteOverviewDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteReferenciaTemporal;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteSerieDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusEvolucaoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusProcessoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteTopClienteDTO;
import com.dashboard.api.repository.FaturasPorClienteSqlRepository;
import com.dashboard.api.util.ConsultaLimiteUtils;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class FaturasPorClienteService {

    private final ValidadorPeriodoService validadorPeriodo;
    private final Clock clock;
    private final FaturasPorClienteSqlRepository sqlRepository;
    private final DashboardTabelaPaginadaService tabelaPaginadaService;

    @Autowired
    public FaturasPorClienteService(
            ValidadorPeriodoService validadorPeriodo,
            FaturasPorClienteSqlRepository sqlRepository,
            DashboardTabelaPaginadaService tabelaPaginadaService
    ) {
        this(validadorPeriodo, sqlRepository, Clock.systemDefaultZone(), tabelaPaginadaService);
    }

    FaturasPorClienteService(
            ValidadorPeriodoService validadorPeriodo,
            FaturasPorClienteSqlRepository sqlRepository,
            Clock clock,
            DashboardTabelaPaginadaService tabelaPaginadaService
    ) {
        this.validadorPeriodo = validadorPeriodo;
        this.sqlRepository = sqlRepository;
        this.clock = clock;
        this.tabelaPaginadaService = tabelaPaginadaService;
    }

    public FaturasPorClienteOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarOverview(filtro, dataDeCorte(filtro));
    }

    public List<FaturasPorClienteMensalDTO> buscarMensal(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarMensal(filtro);
    }

    public List<FaturasPorClienteSerieDTO> buscarSerie(
            FiltroConsultaDTO filtro,
            String granularidade,
            String referencia,
            String metrica
    ) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarSerie(
                filtro,
                FaturasPorClienteGranularidade.from(granularidade),
                FaturasPorClienteReferenciaTemporal.from(referencia),
                FaturasPorClienteMetrica.from(metrica)
        );
    }

    public List<FaturasPorClienteAgingBucketDTO> buscarAging(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarAging(filtro, dataDeCorte(filtro));
    }

    public List<FaturasPorClienteAgingBucketDTO> buscarAging(FiltroConsultaDTO filtro, String escopo) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarAging(filtro, dataDeCorte(filtro), FaturasPorClienteAgingEscopo.from(escopo));
    }

    public List<FaturasPorClienteDrilldownPointDTO> buscarDrilldownAging(
            FiltroConsultaDTO filtro,
            String faixa,
            String nivel,
            String cliente,
            int limite
    ) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarDrilldownAging(filtro, dataDeCorte(filtro), faixa, FaturasPorClienteDrilldownNivel.from(nivel), cliente,
                ConsultaLimiteUtils.limitar(limite, 10, 50));
    }

    public List<ClienteEmAtrasoDTO> buscarClientesEmAtraso(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarClientesEmAtraso(filtro, dataDeCorte(filtro));
    }

    public List<EvolucaoFretesRecebiveisDTO> buscarEvolucaoFretes(
            FiltroConsultaDTO filtro, String granularidade, String referencia) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarEvolucaoFretes(filtro, FaturasPorClienteGranularidade.from(granularidade),
                FaturasPorClienteReferenciaTemporal.from(referencia));
    }

    public List<FaturasPorClienteTopClienteDTO> buscarTopClientes(FiltroConsultaDTO filtro, int limite) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        int limiteAplicado = ConsultaLimiteUtils.limitar(limite, 10, 50);
        return sqlRepository.buscarTopClientes(filtro, limiteAplicado);
    }

    public List<FaturasPorClienteDrilldownPointDTO> buscarDrilldownClientes(
            FiltroConsultaDTO filtro,
            int limite,
            String metrica,
            String nivel,
            String cliente,
            String cnpj
    ) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarDrilldownClientes(
                filtro, dataDeCorte(filtro), ConsultaLimiteUtils.limitar(limite, 10, 50), FaturasPorClienteMetrica.from(metrica),
                FaturasPorClienteDrilldownNivel.from(nivel), cliente, cnpj
        );
    }

    public List<FaturasPorClienteStatusProcessoDTO> buscarStatusProcesso(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarStatusProcesso(filtro);
    }

    public List<FaturasPorClienteStatusEvolucaoDTO> buscarEvolucaoStatus(FiltroConsultaDTO filtro, String granularidade) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarEvolucaoStatus(filtro, FaturasPorClienteGranularidade.from(granularidade));
    }

    public List<FaturaPorClienteResumoDTO> buscarTabela(FiltroConsultaDTO filtro, int limite) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        int limiteAplicado = ConsultaLimiteUtils.limitar(limite, 100, 200);
        return tabelaPaginadaService().buscarPrimeiraPaginaFaturasPorCliente(filtro, limiteAplicado);
    }

    private DashboardTabelaPaginadaService tabelaPaginadaService() {
        if (tabelaPaginadaService == null) {
            throw new IllegalStateException("Tabela de Faturas por Cliente exige DashboardTabelaPaginadaService configurado.");
        }
        return tabelaPaginadaService;
    }

    private LocalDate dataDeCorte(FiltroConsultaDTO filtro) {
        LocalDate hoje = LocalDate.now(clock);
        return filtro.dataFim().isBefore(hoje) ? filtro.dataFim() : hoje;
    }
}
