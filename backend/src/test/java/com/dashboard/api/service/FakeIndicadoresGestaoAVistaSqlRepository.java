package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.indicadoresgestao.CubagemMercadoriasRowDTO;
import com.dashboard.api.dto.indicadoresgestao.CubagemMercadoriasSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.IndenizacaoMercadoriasRowDTO;
import com.dashboard.api.dto.indicadoresgestao.IndenizacaoMercadoriasSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.NivelVisaoPerformance;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaRowDTO;
import com.dashboard.api.dto.indicadoresgestao.PerformanceEntregaSeriePointDTO;
import com.dashboard.api.dto.indicadoresgestao.UtilizacaoColetoresRowDTO;
import com.dashboard.api.dto.indicadoresgestao.UtilizacaoColetoresSeriePointDTO;
import com.dashboard.api.repository.IndicadoresGestaoAVistaSqlRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

class FakeIndicadoresGestaoAVistaSqlRepository extends IndicadoresGestaoAVistaSqlRepository {

    PerformanceEntregaResumo performanceResumo = new PerformanceEntregaResumo(null, 0, 0, 0, 0);
    List<PerformanceEntregaSeriePointDTO> performanceSerie = List.of();
    List<PerformanceEntregaRowDTO> performanceLinhas = List.of();
    long performanceTotal;
    int performanceOffset;
    int performanceLimite;

    CubagemResumo cubagemResumo = new CubagemResumo(null, 0, 0, 0);
    List<CubagemMercadoriasSeriePointDTO> cubagemSerie = List.of();
    List<CubagemMercadoriasRowDTO> cubagemLinhas = List.of();
    long cubagemTotal;
    int cubagemOffset;
    int cubagemLimite;

    IndenizacaoResumo indenizacaoResumo = new IndenizacaoResumo(null, 0, java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO);
    List<IndenizacaoMercadoriasSeriePointDTO> indenizacaoSerie = List.of();
    List<IndenizacaoMercadoriasRowDTO> indenizacaoLinhas = List.of();
    long indenizacaoTotal;
    int indenizacaoOffset;
    int indenizacaoLimite;

    UtilizacaoColetoresResumo coletoresResumo = new UtilizacaoColetoresResumo(null, 0, 0, 0, 0, 0, 0);
    List<UtilizacaoColetoresSeriePointDTO> coletoresSerie = List.of();
    List<UtilizacaoColetoresRankingBase> coletoresRanking = List.of();
    List<UtilizacaoColetoresRowDTO> coletoresLinhas = List.of();
    long coletoresTotal;
    int coletoresOffset;
    int coletoresLimite;
    RuntimeException coletoresResumoException;

    FakeIndicadoresGestaoAVistaSqlRepository() {
        super(new NamedParameterJdbcTemplate(new JdbcTemplate()), PeriodoOffsetDateTimeHelper.padrao(), null);
    }

    @Override
    public PerformanceEntregaResumo buscarPerformanceEntregaResumo(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return performanceResumo;
    }

    @Override
    public List<PerformanceEntregaSeriePointDTO> buscarPerformanceEntregaSerie(
            FiltroConsultaDTO filtro,
            EscopoFilialService.EscopoFilial escopo,
            NivelVisaoPerformance visao,
            String responsavelFiltro,
            String regiaoFiltro
    ) {
        return performanceSerie;
    }

    @Override
    public List<PerformanceEntregaRowDTO> buscarPerformanceEntregaLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo, int offset, int limite) {
        performanceOffset = offset;
        performanceLimite = limite;
        return performanceLinhas;
    }

    @Override
    public long contarPerformanceEntregaLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return performanceTotal;
    }

    @Override
    public CubagemResumo buscarCubagemResumo(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return cubagemResumo;
    }

    @Override
    public List<CubagemMercadoriasSeriePointDTO> buscarCubagemSerie(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return cubagemSerie;
    }

    @Override
    public List<CubagemMercadoriasRowDTO> buscarCubagemLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo, int offset, int limite) {
        cubagemOffset = offset;
        cubagemLimite = limite;
        return cubagemLinhas;
    }

    @Override
    public long contarCubagemLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return cubagemTotal;
    }

    @Override
    public IndenizacaoResumo buscarIndenizacaoResumo(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return indenizacaoResumo;
    }

    @Override
    public List<IndenizacaoMercadoriasSeriePointDTO> buscarIndenizacaoSerie(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return indenizacaoSerie;
    }

    @Override
    public List<IndenizacaoMercadoriasRowDTO> buscarIndenizacaoLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo, int offset, int limite) {
        indenizacaoOffset = offset;
        indenizacaoLimite = limite;
        return indenizacaoLinhas;
    }

    @Override
    public long contarIndenizacaoLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return indenizacaoTotal;
    }

    @Override
    public UtilizacaoColetoresResumo buscarUtilizacaoColetoresResumo(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        if (coletoresResumoException != null) {
            throw coletoresResumoException;
        }
        return coletoresResumo;
    }

    @Override
    public List<UtilizacaoColetoresSeriePointDTO> buscarUtilizacaoColetoresSerie(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return coletoresSerie;
    }

    @Override
    public List<UtilizacaoColetoresRankingBase> buscarUtilizacaoColetoresRanking(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return coletoresRanking;
    }

    @Override
    public List<UtilizacaoColetoresRowDTO> buscarUtilizacaoColetoresLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo, int offset, int limite) {
        coletoresOffset = offset;
        coletoresLimite = limite;
        return coletoresLinhas;
    }

    @Override
    public long contarUtilizacaoColetoresLinhas(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        return coletoresTotal;
    }
}
