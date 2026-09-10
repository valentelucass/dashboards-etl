package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.manifestos.ManifestosCostGoalConfigDTO;
import com.dashboard.api.dto.manifestos.ManifestosCostGoalConfigRequestDTO;
import com.dashboard.api.dto.manifestos.ManifestosCustosEvolucaoDTO;
import com.dashboard.api.dto.manifestos.ManifestosCustosEvolucaoDTO.CustoDiarioDTO;
import com.dashboard.api.model.acesso.ManifestosCostGoalEntity;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.repository.ManifestosCostDataRepository;
import com.dashboard.api.repository.acesso.ManifestosCostGoalRepository;
import com.dashboard.api.repository.acesso.ManifestosCostGoalRepository.GoalAggregateProjection;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ManifestosCostGoalServiceTest {

    private static final ZoneId ZONE_ID_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final LocalDate INICIO_MAIO = LocalDate.of(2026, 5, 1);
    private static final LocalDate FIM_MAIO = LocalDate.of(2026, 5, 19);

    @Mock
    private ManifestosCostGoalRepository goalRepository;

    @Mock
    private ManifestosCostDataRepository performanceRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    private ManifestosCostGoalService service;

    @BeforeEach
    void setUp() {
        service = serviceComEscopo(EscopoFilialService.EscopoFilial.comAcessoTotal());
    }

    @Test
    void calculaOrcamentoDiarioSaldoETendenciaComD1() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(INICIO_MAIO, FIM_MAIO, Map.of());
        List<CustoDiarioDTO> serie = List.of(
                new CustoDiarioDTO("2026-05-18", new BigDecimal("4400000.00")),
                new CustoDiarioDTO("2026-05-19", new BigDecimal("600000.00"))
        );
        stubCalendarioECustos(filtro, serie);
        when(goalRepository.aggregateGlobalOrBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("__all_contract_types__"),
                0,
                List.of("__all_classifications__"),
                0
        ))
                .thenReturn(aggregate("8400000.00", 1));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("5000000.00")
        );

        assertThat(resultado.orcamentoAplicavel()).isTrue();
        assertThat(resultado.orcamentoConfigurado()).isTrue();
        assertThat(resultado.totalDiasUteis()).isEqualTo(20);
        assertThat(resultado.diasUteisDecorridos()).isEqualTo(11);
        assertThat(resultado.diasUteisRestantes()).isEqualTo(9);
        assertThat(resultado.orcamentoCusto()).isEqualByComparingTo("8400000.00");
        assertThat(resultado.custoReal()).isEqualByComparingTo("5000000.00");
        assertThat(resultado.limiteDiarioBase()).isEqualByComparingTo("420000.00");
        assertThat(resultado.custoMedioDiarioReal()).isEqualByComparingTo("400000.00");
        assertThat(resultado.saldoOrcamentario()).isEqualByComparingTo("4000000.00");
        assertThat(resultado.limiteDiarioDinamico()).isEqualByComparingTo("444444.44");
        assertThat(resultado.tendenciaCusto()).isEqualByComparingTo("8600000.00");
        assertThat(resultado.consumoOrcamento()).isEqualByComparingTo("59.52");
        assertThat(resultado.serieDiaria()).isEqualTo(serie);
    }

    @Test
    void travaLimiteDiarioDinamicoEmZeroQuandoOrcamentoEstaEstourado() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(INICIO_MAIO, FIM_MAIO, Map.of());
        stubCalendarioECustos(filtro, List.of());
        when(goalRepository.aggregateGlobalOrBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("__all_contract_types__"),
                0,
                List.of("__all_classifications__"),
                0
        ))
                .thenReturn(aggregate("299000.00", 1));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("5000000.00")
        );

        assertThat(resultado.saldoOrcamentario()).isEqualByComparingTo("-4101000.00");
        assertThat(resultado.limiteDiarioDinamico()).isZero();
    }

    @Test
    void usaMetasPorFilialQuandoEscopoDoUsuarioEhRestrito() {
        service = serviceComEscopo(new EscopoFilialService.EscopoFilial(
                false,
                List.of("SPO", "REC")
        ));
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(INICIO_MAIO, FIM_MAIO, Map.of());
        stubCalendarioECustos(filtro, List.of());
        when(goalRepository.aggregateByBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("REC", "SPO"),
                List.of("__all_contract_types__"),
                0,
                List.of("__all_classifications__"),
                0
        )).thenReturn(aggregate("3000000.00", 2));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("1000000.00")
        );

        assertThat(resultado.orcamentoCusto()).isEqualByComparingTo("3000000.00");
        verify(goalRepository, never()).aggregateGlobalOrBranches(any(), any(), any(), anyInt(), any(), anyInt());
    }

    @Test
    void filtroDeFilialLongaUsaCodigoCurtoParaBuscarMetaOrcamentaria() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                INICIO_MAIO,
                FIM_MAIO,
                Map.of("filiais", List.of("AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"))
        );
        stubCalendarioECustos(filtro, List.of());
        when(goalRepository.aggregateByBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("AGU"),
                List.of("__all_contract_types__"),
                0,
                List.of("__all_classifications__"),
                0
        )).thenReturn(aggregate("1500000.00", 1));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("500000.00")
        );

        assertThat(resultado.orcamentoAplicavel()).isTrue();
        assertThat(resultado.orcamentoConfigurado()).isTrue();
        assertThat(resultado.orcamentoCusto()).isEqualByComparingTo("1500000.00");
        verify(goalRepository, never()).aggregateGlobalOrBranches(any(), any(), any(), anyInt(), any(), anyInt());
    }

    @Test
    void filtroOrcamentarioNormalizadoNaoSubstituiFiltroOriginalDasConsultasDeFato() {
        FiltroConsultaDTO filtroFato = new FiltroConsultaDTO(
                INICIO_MAIO,
                FIM_MAIO,
                Map.of("filiais", List.of("AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"))
        );
        FiltroConsultaDTO filtroOrcamento = new FiltroConsultaDTO(
                INICIO_MAIO,
                FIM_MAIO,
                Map.of("filiais", List.of("AGU"))
        );
        stubCalendarioECustos(filtroFato, List.of());
        when(goalRepository.aggregateByBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("AGU"),
                List.of("__all_contract_types__"),
                0,
                List.of("__all_classifications__"),
                0
        )).thenReturn(aggregate("1500000.00", 1));

        service.calcular(filtroFato, filtroOrcamento, new BigDecimal("500000.00"));

        verify(performanceRepository).buscarCustosDiarios(filtroFato);
        ArgumentCaptor<FiltroConsultaDTO> custoFechadoCaptor = ArgumentCaptor.forClass(FiltroConsultaDTO.class);
        verify(performanceRepository).buscarCustoTotal(custoFechadoCaptor.capture());
        assertThat(custoFechadoCaptor.getValue().valores("filiais"))
                .containsExactly("AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA");
    }

    @Test
    void aplicaFiltroDeTipoContratoNaMeta() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                INICIO_MAIO,
                FIM_MAIO,
                Map.of("tiposContrato", List.of("Frota + PX"))
        );
        stubCalendarioECustos(filtro, List.of());
        when(goalRepository.aggregateGlobalOrBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("FROTA + PX"),
                1,
                List.of("__all_classifications__"),
                0
        )).thenReturn(aggregate("1200000.00", 1));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("300000.00")
        );

        assertThat(resultado.orcamentoAplicavel()).isTrue();
        assertThat(resultado.orcamentoConfigurado()).isTrue();
        assertThat(resultado.orcamentoCusto()).isEqualByComparingTo("1200000.00");
    }

    @Test
    void aplicaFiltroDeClassificacaoNaMetaComChaveCanonica() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                INICIO_MAIO,
                FIM_MAIO,
                Map.of("classificacoes", List.of("distribuição"))
        );
        stubCalendarioECustos(filtro, List.of());
        when(goalRepository.aggregateGlobalOrBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("__all_contract_types__"),
                0,
                List.of("DISTRIBUIÇÃO"),
                1
        )).thenReturn(aggregate("900000.00", 1));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("300000.00")
        );

        assertThat(resultado.orcamentoAplicavel()).isTrue();
        assertThat(resultado.orcamentoConfigurado()).isTrue();
        assertThat(resultado.orcamentoCusto()).isEqualByComparingTo("900000.00");
    }

    @Test
    void naoAplicaOrcamentoComFiltroSemDimensaoOrcamentaria() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(
                INICIO_MAIO,
                FIM_MAIO,
                Map.of(
                        "motoristas", List.of("Motorista A"),
                        "numeroManifesto", List.of("62848")
                )
        );
        stubCalendarioECustos(filtro, List.of());

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("1000000.00")
        );

        assertThat(resultado.orcamentoAplicavel()).isFalse();
        assertThat(resultado.orcamentoConfigurado()).isFalse();
        assertThat(resultado.observacao()).contains("motoristas");
        assertThat(resultado.observacao()).contains("numeroManifesto");
        assertThat(resultado.orcamentoCusto()).isZero();
        assertThat(resultado.tendenciaCusto()).isEqualByComparingTo("4600000.00");
        verifyNoInteractions(goalRepository);
    }

    @Test
    void metaAusenteNaoProduzSaldoOrcamentarioArtificial() {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(INICIO_MAIO, FIM_MAIO, Map.of());
        stubCalendarioECustos(filtro, List.of());
        when(goalRepository.aggregateGlobalOrBranches(
                INICIO_MAIO,
                LocalDate.of(2026, 6, 1),
                List.of("__all_contract_types__"),
                0,
                List.of("__all_classifications__"),
                0
        ))
                .thenReturn(aggregate("0.00", 0));

        ManifestosCustosEvolucaoDTO resultado = service.calcular(
                filtro,
                new BigDecimal("1000000.00")
        );

        assertThat(resultado.orcamentoAplicavel()).isTrue();
        assertThat(resultado.orcamentoConfigurado()).isFalse();
        assertThat(resultado.saldoOrcamentario()).isZero();
        assertThat(resultado.limiteDiarioDinamico()).isZero();
        assertThat(resultado.consumoOrcamento()).isZero();
    }

    @Test
    void salvarNormalizaFilialContratoEClassificacaoEmCaixaAlta() {
        service = serviceComUsuario();
        UsuarioEntity usuario = usuario("admin@example.com");
        AtomicReference<ManifestosCostGoalEntity> salva = new AtomicReference<>();

        when(goalRepository.findByBranchIdAndYearMonthAndContractTypeKeyAndClassificationKey(
                "SPO",
                INICIO_MAIO,
                "FROTA + PX",
                "DISTRIBUIÇÃO"
        )).thenReturn(Optional.empty());
        when(usuarioRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(usuario));
        when(goalRepository.saveAndFlush(any(ManifestosCostGoalEntity.class))).thenAnswer(invocation -> {
            ManifestosCostGoalEntity entity = invocation.getArgument(0);
            salva.set(entity);
            return entity;
        });

        service.salvar(new ManifestosCostGoalConfigRequestDTO(
                " spo ",
                " frota + px ",
                " frota + px ",
                " distribuição ",
                2026,
                5,
                new BigDecimal("1200.129")
        ), "admin@example.com");

        assertThat(salva.get().getBranchId()).isEqualTo("SPO");
        assertThat(salva.get().getContractType()).isEqualTo("FROTA + PX");
        assertThat(salva.get().getContractTypeKey()).isEqualTo("FROTA + PX");
        assertThat(salva.get().getClassificationKey()).isEqualTo("DISTRIBUIÇÃO");
        assertThat(salva.get().getCostGoal()).isEqualByComparingTo("1200.13");
    }

    @Test
    void listarComFilialAplicaFiltroNoRepositorio() {
        LocalDate competencia = LocalDate.of(2026, 7, 1);
        when(goalRepository.findAllByBranchIdAndYearMonthOrdered("AGU", competencia)).thenReturn(List.of(
                meta("AGU", competencia, "TERCEIRO", "TERCEIRO", "TRANSFERÊNCIA", "1200.00")
        ));

        List<ManifestosCostGoalConfigDTO> resultado = service.listar(2026, 7, " agu ");

        assertThat(resultado).hasSize(1);
        assertThat(resultado).extracting(ManifestosCostGoalConfigDTO::branchId).containsExactly("AGU");
        verify(goalRepository).findAllByBranchIdAndYearMonthOrdered("AGU", competencia);
        verify(goalRepository, never()).findAllByYearMonthOrdered(competencia);
    }

    @Test
    void listarComFilialSemMetasRetornaListaVazia() {
        LocalDate competencia = LocalDate.of(2026, 7, 1);
        when(goalRepository.findAllByBranchIdAndYearMonthOrdered("AGU", competencia)).thenReturn(List.of());

        List<ManifestosCostGoalConfigDTO> resultado = service.listar(2026, 7, "AGU");

        assertThat(resultado).isEmpty();
        verify(goalRepository).findAllByBranchIdAndYearMonthOrdered("AGU", competencia);
        verify(goalRepository, never()).findAllByYearMonthOrdered(competencia);
    }

    @Test
    void replicarCopiaMetasDoMesAnteriorParaDestinoVazio() {
        service = serviceComUsuario();
        LocalDate destino = LocalDate.of(2026, 7, 1);
        LocalDate origem = LocalDate.of(2026, 6, 1);
        UsuarioEntity usuario = usuario("admin@example.com");
        AtomicReference<List<ManifestosCostGoalEntity>> salvas = new AtomicReference<>(List.of());

        when(goalRepository.countByYearMonth(destino)).thenReturn(0L);
        when(goalRepository.countByYearMonth(origem)).thenReturn(2L);
        when(goalRepository.findAllByYearMonthForReplication(origem)).thenReturn(List.of(
                meta("SPO", origem, "Frota", "frota", "distribuicao", "1000.50"),
                meta(null, origem, "Geral", "geral", null, "299000.00")
        ));
        when(usuarioRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(usuario));
        when(goalRepository.saveAllAndFlush(any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<ManifestosCostGoalEntity> entities = (List<ManifestosCostGoalEntity>) invocation.getArgument(0);
            salvas.set(entities);
            return entities;
        });
        when(goalRepository.findAllByYearMonthOrdered(destino)).thenAnswer(invocation -> salvas.get());

        var resultado = service.replicar(2026, 7, "admin@example.com");

        assertThat(resultado).hasSize(2);
        assertThat(salvas.get()).hasSize(2);
        assertThat(salvas.get()).extracting(ManifestosCostGoalEntity::getYearMonth).containsOnly(destino);
        assertThat(salvas.get()).extracting(ManifestosCostGoalEntity::getBranchId).containsExactly("SPO", null);
        assertThat(salvas.get()).extracting(ManifestosCostGoalEntity::getContractTypeKey)
                .containsExactly("FROTA", "GERAL");
        assertThat(salvas.get()).extracting(ManifestosCostGoalEntity::getClassificationKey)
                .containsExactly("DISTRIBUICAO", null);
        assertThat(salvas.get()).extracting(ManifestosCostGoalEntity::getCostGoal)
                .containsExactly(new BigDecimal("1000.50"), new BigDecimal("299000.00"));
        assertThat(salvas.get()).extracting(ManifestosCostGoalEntity::getUpdatedByUser)
                .containsOnly(usuario);
    }

    @Test
    void replicarNaoSobrescreveDestinoComMetasCadastradas() {
        service = serviceComUsuario();
        LocalDate destino = LocalDate.of(2026, 7, 1);
        when(goalRepository.countByYearMonth(destino)).thenReturn(1L);

        assertThatThrownBy(() -> service.replicar(2026, 7, "admin@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("07/2026");

        verify(goalRepository, never()).findAllByYearMonthForReplication(any());
        verify(goalRepository, never()).saveAllAndFlush(any());
        verifyNoInteractions(usuarioRepository);
    }

    @Test
    void replicarExigeMetasNoMesAnterior() {
        service = serviceComUsuario();
        LocalDate destino = LocalDate.of(2026, 7, 1);
        LocalDate origem = LocalDate.of(2026, 6, 1);
        when(goalRepository.countByYearMonth(destino)).thenReturn(0L);
        when(goalRepository.countByYearMonth(origem)).thenReturn(0L);

        assertThatThrownBy(() -> service.replicar(2026, 7, "admin@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("06/2026");

        verify(goalRepository, never()).findAllByYearMonthForReplication(any());
        verify(goalRepository, never()).saveAllAndFlush(any());
        verifyNoInteractions(usuarioRepository);
    }

    private void stubCalendarioECustos(FiltroConsultaDTO filtro, List<CustoDiarioDTO> serie) {
        when(performanceRepository.buscarCustosDiarios(filtro)).thenReturn(serie);
        when(performanceRepository.buscarUltimoDiaUtilFechado(FIM_MAIO))
                .thenReturn(LocalDate.of(2026, 5, 18));
        when(performanceRepository.contarDiasUteisCalendario(
                INICIO_MAIO,
                LocalDate.of(2026, 5, 31)
        )).thenReturn(20);
        when(performanceRepository.contarDiasUteisCalendario(
                INICIO_MAIO,
                LocalDate.of(2026, 5, 18)
        )).thenReturn(11);
        when(performanceRepository.buscarCustoTotal(any(FiltroConsultaDTO.class)))
                .thenReturn(new BigDecimal("4400000.00"));
    }

    @ParameterizedTest
    @CsvSource({"1,17,false,10.00", "1,18,false,10.00", "1,19,true,7.00", "19,19,false,0.00"})
    void consultaCustoFechadoSomenteQuandoJanelaDifereDoTotalRecebido(
            int diaInicio, int diaFim, boolean consultaAdicional, String mediaEsperada) {
        FiltroConsultaDTO filtro = new FiltroConsultaDTO(LocalDate.of(2026, 5, diaInicio),
                LocalDate.of(2026, 5, diaFim), Map.of("filiais", List.of("SPO"), "status", List.of("Encerrado")));
        when(performanceRepository.buscarUltimoDiaUtilFechado(FIM_MAIO)).thenReturn(LocalDate.of(2026, 5, 18));
        when(performanceRepository.contarDiasUteisCalendario(any(), any())).thenReturn(10);
        if (consultaAdicional) {
            when(performanceRepository.buscarCustoTotal(any())).thenReturn(new BigDecimal("70.00"));
        }

        ManifestosCustosEvolucaoDTO resultado = service.calcular(filtro, new BigDecimal("100.00"));

        assertThat(resultado.custoReal()).isEqualByComparingTo("100.00");
        assertThat(resultado.custoMedioDiarioReal()).isEqualByComparingTo(mediaEsperada);
        verify(performanceRepository).buscarCustosDiarios(filtro);
        if (consultaAdicional) {
            verify(performanceRepository).buscarCustoTotal(new FiltroConsultaDTO(filtro.dataInicio(),
                    LocalDate.of(2026, 5, 18), filtro.filtros()));
        } else {
            verify(performanceRepository, never()).buscarCustoTotal(any());
        }
        verifyNoInteractions(goalRepository);
    }

    private ManifestosCostGoalService serviceComEscopo(EscopoFilialService.EscopoFilial escopo) {
        return new ManifestosCostGoalService(
                goalRepository,
                performanceRepository,
                escopoService(escopo),
                Clock.fixed(Instant.parse("2026-05-19T12:00:00Z"), ZONE_ID_BRASILIA)
        );
    }

    private ManifestosCostGoalService serviceComUsuario() {
        return new ManifestosCostGoalService(
                goalRepository,
                performanceRepository,
                escopoService(EscopoFilialService.EscopoFilial.comAcessoTotal()),
                usuarioRepository,
                Clock.fixed(Instant.parse("2026-05-19T12:00:00Z"), ZONE_ID_BRASILIA)
        );
    }

    private EscopoFilialService escopoService(EscopoFilialService.EscopoFilial escopo) {
        EscopoFilialService escopoService = new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return escopo;
            }
        };
        return escopoService;
    }

    private static GoalAggregateProjection aggregate(String valor, long configuradas) {
        return new GoalAggregateProjection() {
            @Override
            public BigDecimal getCostGoal() {
                return new BigDecimal(valor);
            }

            @Override
            public long getConfiguredGoals() {
                return configuradas;
            }
        };
    }

    private static ManifestosCostGoalEntity meta(
            String branchId,
            LocalDate competencia,
            String contractType,
            String contractTypeKey,
            String classificationKey,
            String costGoal
    ) {
        ManifestosCostGoalEntity entity = new ManifestosCostGoalEntity();
        entity.setBranchId(branchId);
        entity.setYearMonth(competencia);
        entity.setContractType(contractType);
        entity.setContractTypeKey(contractTypeKey);
        entity.setClassificationKey(classificationKey);
        entity.setCostGoal(new BigDecimal(costGoal));
        return entity;
    }

    private static UsuarioEntity usuario(String email) {
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(42L);
        usuario.setLogin("admin");
        usuario.setNome("Admin");
        usuario.setEmail(email);
        usuario.setSenhaHash("hash");
        return usuario;
    }
}
