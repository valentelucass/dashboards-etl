package com.dashboard.api.service;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.tracking.TrackingChartsDTO;
import com.dashboard.api.dto.tracking.TrackingDashboardDTO;
import com.dashboard.api.dto.tracking.TrackingOverviewDTO;
import com.dashboard.api.dto.tracking.TrackingResumoDTO;
import com.dashboard.api.dto.tracking.TrackingTimelinePointDTO;
import com.dashboard.api.repository.TrackingSqlRepository;
import com.dashboard.api.repository.VisaoLocalizacaoCargasRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.ConsultaLimiteUtils;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TrackingService {

    private final ValidadorPeriodoService validadorPeriodo;
    private final EscopoFilialService escopoFilialService;
    private final TrackingSqlRepository trackingSqlRepository;
    private final DashboardTabelaPaginadaService tabelaPaginadaService;

    TrackingService(ValidadorPeriodoService validadorPeriodo, VisaoLocalizacaoCargasRepository repository) {
        this(validadorPeriodo, repository, (TrackingSqlRepository) null);
    }

    TrackingService(
            ValidadorPeriodoService validadorPeriodo,
            VisaoLocalizacaoCargasRepository repository,
            TrackingSqlRepository trackingSqlRepository
    ) {
        this(
                validadorPeriodo,
                repository,
                escopoSemRestricao(),
                PeriodoOffsetDateTimeHelper.padrao(),
                null,
                null,
                trackingSqlRepository,
                null
        );
    }

    @Autowired
    public TrackingService(
            ValidadorPeriodoService validadorPeriodo,
            VisaoLocalizacaoCargasRepository repository,
            EscopoFilialService escopoFilialService,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper,
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder,
            TrackingSqlRepository trackingSqlRepository,
            DashboardTabelaPaginadaService tabelaPaginadaService
    ) {
        this.validadorPeriodo = validadorPeriodo;
        this.escopoFilialService = escopoFilialService;
        this.trackingSqlRepository = trackingSqlRepository;
        this.tabelaPaginadaService = tabelaPaginadaService;
    }

    TrackingService(
            ValidadorPeriodoService validadorPeriodo,
            VisaoLocalizacaoCargasRepository repository,
            EscopoFilialService escopoFilialService,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper,
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder
    ) {
        this(
                validadorPeriodo,
                repository,
                escopoFilialService,
                periodoOffsetDateTimeHelper,
                jdbcTemplate,
                sqlBuilder,
                jdbcTemplate != null && sqlBuilder != null
                        ? new TrackingSqlRepository(jdbcTemplate, sqlBuilder, escopoFilialService, periodoOffsetDateTimeHelper)
                        : null,
                null
        );
    }

    TrackingService(
            ValidadorPeriodoService validadorPeriodo,
            VisaoLocalizacaoCargasRepository repository,
            EscopoFilialService escopoFilialService,
            PeriodoOffsetDateTimeHelper periodoOffsetDateTimeHelper,
            @ConsultaAnalitica NamedParameterJdbcTemplate jdbcTemplate,
            DashboardExportSqlBuilder sqlBuilder,
            TrackingSqlRepository trackingSqlRepository
    ) {
        this(
                validadorPeriodo,
                repository,
                escopoFilialService,
                periodoOffsetDateTimeHelper,
                jdbcTemplate,
                sqlBuilder,
                trackingSqlRepository,
                null
        );
    }

    public TrackingOverviewDTO buscarOverview(LocalDate dataInicio, LocalDate dataFim) {
        return buscarOverview(new FiltroConsultaDTO(dataInicio, dataFim, Map.of()));
    }

    public TrackingOverviewDTO buscarOverview(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository().buscarOverview(filtro);
    }

    public TrackingDashboardDTO buscarDashboard(FiltroConsultaDTO filtro) {
        if (trackingSqlRepository == null) {
            throw new IllegalStateException("Tracking dashboard analitico exige JdbcTemplate e SQL builder.");
        }
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());

        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        FiltroConsultaDTO filtroObrigatorio = aplicarFilialAtualObrigatoria(filtro, escopo);
        return trackingSqlRepository.buscarDashboardConsultaUnica(filtroObrigatorio);
    }

    public FiltroConsultaDTO normalizarFiltroComFilialAtualObrigatoria(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return aplicarFilialAtualObrigatoria(filtro, escopoFilialService.escopoAtual());
    }

    public List<TrackingTimelinePointDTO> buscarSerie(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository().buscarSerie(filtro);
    }

    public List<TrackingResumoDTO> buscarTabela(FiltroConsultaDTO filtro, int limite) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        int limiteAplicado = ConsultaLimiteUtils.limitar(limite, 100, 200);
        return tabelaPaginadaService().buscarPrimeiraPaginaTracking(filtro, limiteAplicado);
    }

    public TrackingChartsDTO buscarGraficos(FiltroConsultaDTO filtro) {
        validadorPeriodo.validar(filtro.dataInicio(), filtro.dataFim());
        return sqlRepository().buscarGraficos(filtro);
    }

    private FiltroConsultaDTO aplicarFilialAtualObrigatoria(FiltroConsultaDTO filtro, EscopoFilialService.EscopoFilial escopo) {
        List<String> filiaisAtuais = filtro.valores("filialAtual");
        if (filiaisAtuais.size() == 1) {
            return filtro;
        }
        if (filiaisAtuais.size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione apenas uma Filial Atual para o painel de Localização de Cargas.");
        }

        List<String> filiaisPermitidas = escopo.filiaisOrdenadas();
        if (!escopo.acessoTotal() && filiaisPermitidas.size() == 1) {
            Map<String, List<String>> filtros = new LinkedHashMap<>(filtro.filtros());
            filtros.put("filialAtual", List.of(filiaisPermitidas.get(0)));
            return new FiltroConsultaDTO(filtro.dataInicio(), filtro.dataFim(), filtros);
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Filial Atual é obrigatória para carregar o painel de Localização de Cargas.");
    }

    private TrackingSqlRepository sqlRepository() {
        if (trackingSqlRepository == null) {
            throw new IllegalStateException("Tracking agregado exige TrackingSqlRepository configurado.");
        }
        return trackingSqlRepository;
    }

    private DashboardTabelaPaginadaService tabelaPaginadaService() {
        if (tabelaPaginadaService == null) {
            throw new IllegalStateException("Tracking tabela exige DashboardTabelaPaginadaService configurado.");
        }
        return tabelaPaginadaService;
    }

    private static EscopoFilialService escopoSemRestricao() {
        return new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };
    }
}
