package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaOverviewDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaRowDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.NivelVisaoPerformance;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.repository.IndicadoresGestaoAVistaSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.ConsultaLimiteUtils;
import com.dashboard.api.util.PerformanceMetricasUtils;
import com.dashboard.api.util.TemporalJsonUtils;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class PerformanceEntregaIndicadorService {

    private final ValidadorPeriodoService validadorPeriodo;
    private final IndicadoresGestaoAVistaSqlRepository sqlRepository;
    private final EscopoFilialService escopoFilialService;

    public PerformanceEntregaIndicadorService(
            ValidadorPeriodoService validadorPeriodo,
            IndicadoresGestaoAVistaSqlRepository sqlRepository,
            EscopoFilialService escopoFilialService
    ) {
        this.validadorPeriodo = validadorPeriodo;
        this.sqlRepository = sqlRepository;
        this.escopoFilialService = escopoFilialService;
    }

    public PerformanceEntregaOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());

        IndicadoresGestaoAVistaSqlRepository.PerformanceEntregaResumo resumo =
                sqlRepository.buscarPerformanceEntregaResumo(filtro, escopoFilialService.escopoAtual());
        return new PerformanceEntregaOverviewDTO(
                updatedAtOuAgora(resumo.updatedAt()),
                inteiro(resumo.totalEntregas()),
                inteiro(resumo.finalizadas()),
                inteiro(resumo.entregasNoPrazo()),
                inteiro(resumo.entregasForaDoPrazo()),
                PerformanceMetricasUtils.percentual(resumo.entregasNoPrazo(), resumo.finalizadas())
        );
    }

    public List<PerformanceEntregaSeriePointDTO> buscarSerie(
            FiltroConsultaDTO filtro,
            NivelVisaoPerformance visao,
            String responsavelFiltro,
            String regiaoFiltro
    ) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        NivelVisaoPerformance visaoObrigatoria = Objects.requireNonNull(visao, "visao");
        String responsavel = normalizarOpcional(responsavelFiltro);
        String regiao = normalizarOpcional(regiaoFiltro);

        if (visaoObrigatoria.exigeResponsavelFiltro() && responsavel == null) {
            throw new IllegalArgumentException("responsavelFiltro é obrigatório para a visão " + visaoObrigatoria);
        }
        if (visaoObrigatoria.exigeRegiaoFiltro() && regiao == null) {
            throw new IllegalArgumentException("regiaoFiltro é obrigatório para a visão " + visaoObrigatoria);
        }

        return sqlRepository.buscarPerformanceEntregaSerie(
                filtro,
                escopoFilialService.escopoAtual(),
                visaoObrigatoria,
                responsavel,
                regiao
        );
    }

    public List<PerformanceEntregaRowDTO> buscarTabela(FiltroConsultaDTO filtro, int limite) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        int limiteAplicado = ConsultaLimiteUtils.limitar(limite, 100, 500);
        return sqlRepository.buscarPerformanceEntregaLinhas(
                filtro,
                escopoFilialService.escopoAtual(),
                0,
                limiteAplicado
        );
    }

    public List<PerformanceEntregaRowDTO> buscarExportacao(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository.buscarPerformanceEntregaExportacao(filtro, escopoFilialService.escopoAtual());
    }

    public PaginaDTO<PerformanceEntregaRowDTO> buscarTabelaPaginada(
            FiltroConsultaDTO filtro,
            int pagina,
            int tamanhoPagina
    ) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        int paginaAplicada = Math.max(1, pagina);
        int tamanhoAplicado = ConsultaLimiteUtils.limitar(tamanhoPagina, 10, 100);
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        long total = sqlRepository.contarPerformanceEntregaLinhas(filtro, escopo);
        List<PerformanceEntregaRowDTO> conteudo = sqlRepository.buscarPerformanceEntregaLinhas(
                filtro,
                escopo,
                (paginaAplicada - 1) * tamanhoAplicado,
                tamanhoAplicado
        );

        return new PaginaDTO<>(
                conteudo,
                total,
                total == 0 ? 0 : (int) Math.ceil(total / (double) tamanhoAplicado),
                paginaAplicada,
                tamanhoAplicado
        );
    }

    private static String updatedAtOuAgora(String updatedAt) {
        return TemporalJsonUtils.garantirIsoComOffset(updatedAt);
    }

    private static int inteiro(long valor) {
        if (valor > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) valor;
    }

    private static String normalizarOpcional(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }
}
