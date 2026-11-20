package com.dashboard.api.service;

import com.dashboard.api.dto.faturascliente.FaturaPorClienteResumoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteOverviewDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteStatusProcessoDTO;
import com.dashboard.api.dto.faturascliente.FaturasPorClienteTopClienteDTO;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.model.VisaoFaturasClienteEntity;
import com.dashboard.api.repository.FaturasPorClienteSqlRepository;
import com.dashboard.api.repository.VisaoFaturasClienteRepository;
import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.Mock;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FaturasPorClienteServiceTest {

    @Mock
    private VisaoFaturasClienteRepository repository;

    private FakeFaturasPorClienteSqlRepository sqlRepository;
    private FakeDashboardTabelaPaginadaService tabelaPaginadaService;

    private FaturasPorClienteService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-03-23T12:00:00Z"), ZoneOffset.UTC);
        sqlRepository = new FakeFaturasPorClienteSqlRepository();
        tabelaPaginadaService = new FakeDashboardTabelaPaginadaService();
        service = new FaturasPorClienteService(
                new ValidadorPeriodoService(),
                sqlRepository,
                clock,
                tabelaPaginadaService
        );
    }

    @Test
    void buscarOverviewDeveNormalizarLinhasDuplicadasPorIdUnico() {
        when(repository.findPowerBiRowsByDataEmissaoCteNaJanela(any(), any())).thenReturn(List.of(
                linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                        LocalDateTime.of(2026, 3, 21, 10, 0)),
                linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                        LocalDateTime.of(2026, 3, 23, 10, 0)),
                linha("uid-2", null, null, null, "80.00", "Cliente B", "Filial 1",
                        null, null, null, LocalDateTime.of(2026, 3, 22, 9, 0))
        ));
        sqlRepository.overview = new FaturasPorClienteOverviewDTO(
                "2026-03-23T10:00:00",
                new BigDecimal("100.00"),
                1,
                1,
                0,
                0.0,
                2,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null
        );

        FaturasPorClienteOverviewDTO overview = service.buscarOverview(filtroPadrao());

        assertThat(overview.valorFaturado()).isEqualByComparingTo("100.00");
        assertThat(overview.registrosFaturados()).isEqualTo(1);
        assertThat(overview.aguardandoFaturamento()).isEqualTo(1);
        assertThat(overview.clientesAtivos()).isEqualTo(2);
    }

    @Test
    void buscarOverviewDevePreservarItensDaMesmaFaturaComIdsDiferentes() {
        VisaoFaturasClienteEntity primeira = linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                LocalDateTime.of(2026, 3, 21, 10, 0));
        VisaoFaturasClienteEntity segunda = linha("uid-2", "DOC-1", "100.00", null, null, "Cliente B", "Filial 2",
                LocalDate.of(2026, 3, 2), LocalDate.of(2026, 3, 10), null,
                LocalDateTime.of(2026, 3, 22, 10, 0));
        ReflectionTestUtils.setField(primeira, "clienteCnpj", "11111111000191");
        ReflectionTestUtils.setField(segunda, "clienteCnpj", "22222222000192");
        ReflectionTestUtils.setField(primeira, "pagadorDocumento", "11.111.111/0001-91");
        ReflectionTestUtils.setField(segunda, "pagadorDocumento", "22.222.222/0001-92");

        when(repository.findPowerBiRowsByDataEmissaoCteNaJanela(any(), any())).thenReturn(List.of(
                primeira,
                segunda,
                linha("uid-3", "DOC-2", "75.00", null, null, "Cliente A", "Filial 1",
                        LocalDate.of(2026, 3, 2), LocalDate.of(2026, 3, 12), null,
                        LocalDateTime.of(2026, 3, 23, 10, 0))
        ));
        sqlRepository.overview = new FaturasPorClienteOverviewDTO(
                "2026-03-23T10:00:00",
                new BigDecimal("275.00"),
                3,
                0,
                0,
                0.0,
                3,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null
        );

        FaturasPorClienteOverviewDTO overview = service.buscarOverview(filtroPadrao());

        assertThat(overview.valorFaturado()).isEqualByComparingTo("275.00");
        assertThat(overview.registrosFaturados()).isEqualTo(3);
        assertThat(overview.clientesAtivos()).isEqualTo(3);
    }

    @Test
    void buscarOverviewDeveContarTitulosEmAtrasoApenasComDocumentoEVencidosSemBaixa() {
        when(repository.findPowerBiRowsByDataEmissaoCteNaJanela(any(), any())).thenReturn(List.of(
                linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                        LocalDateTime.of(2026, 3, 23, 8, 0)),
                linha("uid-2", "DOC-2", "120.00", null, null, "Cliente B", "Filial 1",
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 25), null,
                        LocalDateTime.of(2026, 3, 23, 8, 0)),
                linha("uid-3", "DOC-3", "90.00", null, null, "Cliente C", "Filial 1",
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 9), LocalDate.of(2026, 3, 11),
                        LocalDateTime.of(2026, 3, 23, 8, 0)),
                linha("uid-4", null, null, null, "70.00", "Cliente D", "Filial 1",
                        null, LocalDate.of(2026, 3, 5), null,
                        LocalDateTime.of(2026, 3, 23, 8, 0))
        ));
        sqlRepository.overview = new FaturasPorClienteOverviewDTO(
                "2026-03-23T08:00:00",
                new BigDecimal("310.00"),
                3,
                1,
                1,
                0.0,
                4,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null
        );

        FaturasPorClienteOverviewDTO overview = service.buscarOverview(filtroPadrao());

        assertThat(overview.titulosEmAtraso()).isEqualTo(1);
    }

    @Test
    void buscarStatusProcessoDeveSepararFaturadoEAguardando() {
        when(repository.findPowerBiRowsByDataEmissaoCteNaJanela(any(), any())).thenReturn(List.of(
                linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                        LocalDateTime.of(2026, 3, 23, 8, 0)),
                linha("uid-2", null, null, null, "80.00", "Cliente B", "Filial 1",
                        null, null, null, LocalDateTime.of(2026, 3, 23, 8, 0)),
                linha("uid-3", null, null, null, "70.00", "Cliente C", "Filial 1",
                        null, null, null, LocalDateTime.of(2026, 3, 23, 8, 0))
        ));
        sqlRepository.status = List.of(
                new FaturasPorClienteStatusProcessoDTO("Aguardando Faturamento", 2),
                new FaturasPorClienteStatusProcessoDTO("Faturado", 1)
        );

        List<FaturasPorClienteStatusProcessoDTO> status = service.buscarStatusProcesso(filtroPadrao());

        assertThat(status).containsExactlyInAnyOrder(
                new FaturasPorClienteStatusProcessoDTO("Aguardando Faturamento", 2),
                new FaturasPorClienteStatusProcessoDTO("Faturado", 1)
        );
    }

    @Test
    void buscarTopClientesDeveAgruparPorCnpjQuandoDisponivel() {
        VisaoFaturasClienteEntity primeira = linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                LocalDateTime.of(2026, 3, 23, 8, 0));
        VisaoFaturasClienteEntity segunda = linha("uid-2", "DOC-2", "200.00", null, null, "Cliente A Matriz", "Filial 1",
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                LocalDateTime.of(2026, 3, 23, 8, 0));
        ReflectionTestUtils.setField(primeira, "clienteCnpj", "12.345.678/0001-90");
        ReflectionTestUtils.setField(segunda, "clienteCnpj", "12345678000190");
        when(repository.findPowerBiRowsByDataEmissaoCteNaJanela(any(), any())).thenReturn(List.of(primeira, segunda));
        sqlRepository.topClientes = List.of(new FaturasPorClienteTopClienteDTO(
                "Cliente A",
                "12.345.678/0001-90",
                new BigDecimal("300.00"), BigDecimal.ZERO
        ));

        List<FaturasPorClienteTopClienteDTO> topClientes = service.buscarTopClientes(filtroPadrao(), 10);

        assertThat(topClientes).containsExactly(new FaturasPorClienteTopClienteDTO(
                "Cliente A",
                "12.345.678/0001-90",
                new BigDecimal("300.00"), BigDecimal.ZERO
        ));
    }

    @Test
    void buscarTopClientesDeveUsarDocumentoDoPagadorQuandoClienteCnpjEstiverVazio() {
        VisaoFaturasClienteEntity row = linha("uid-1", "DOC-1", "100.00", null, null, "Cliente A", "Filial 1",
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10), null,
                LocalDateTime.of(2026, 3, 23, 8, 0));
        ReflectionTestUtils.setField(row, "pagadorDocumento", "12.345.678/0001-90");
        when(repository.findPowerBiRowsByDataEmissaoCteNaJanela(any(), any())).thenReturn(List.of(row));
        sqlRepository.topClientes = List.of(new FaturasPorClienteTopClienteDTO(
                "Cliente A",
                "12345678000190",
                new BigDecimal("100.00"), BigDecimal.ZERO
        ));

        List<FaturasPorClienteTopClienteDTO> topClientes = service.buscarTopClientes(filtroPadrao(), 10);

        assertThat(topClientes).containsExactly(new FaturasPorClienteTopClienteDTO(
                "Cliente A",
                "12345678000190",
                new BigDecimal("100.00"), BigDecimal.ZERO
        ));
    }

    @Test
    void buscarTabelaDeveUsarIdUnicoComoChaveDaLinha() {
        tabelaPaginadaService.tabela = List.of(new FaturaPorClienteResumoDTO(
                "uid-1",
                "DOC-1",
                "2026-03-01",
                "2026-03-10",
                null,
                "Filial 1",
                "Cliente A",
                "12.345.678/0001-90",
                12345L,
                new BigDecimal("100.00"),
                "Faturado"
        ));

        List<FaturaPorClienteResumoDTO> tabela = service.buscarTabela(filtroPadrao(), 10);

        assertThat(tabela).hasSize(1);
        assertThat(tabelaPaginadaService.filtroTabela).isEqualTo(filtroPadrao());
        assertThat(tabelaPaginadaService.limiteTabela).isEqualTo(10);
        assertThat(tabela.get(0).idUnico()).isEqualTo("uid-1");
        assertThat(tabela.get(0).documentoFatura()).isEqualTo("DOC-1");
        assertThat(tabela.get(0).clienteCnpj()).isEqualTo("12.345.678/0001-90");
        assertThat(tabela.get(0).statusProcesso()).isEqualTo("Faturado");
    }

    @Test
    void buscarTabelaDeveAplicarLimiteAntesDeDelegarParaPaginacaoNativa() {
        tabelaPaginadaService.tabela = List.of();

        List<FaturaPorClienteResumoDTO> tabela = service.buscarTabela(filtroPadrao(), 500);

        assertThat(tabela).isEmpty();
        assertThat(tabelaPaginadaService.limiteTabela).isEqualTo(200);
    }

    @Test
    void buscarOverviewDeveUsarDataReferenciaDoClock() {
        sqlRepository.overview = new FaturasPorClienteOverviewDTO(
                "2026-03-23T12:00:00",
                BigDecimal.ZERO,
                0,
                0,
                0,
                0.0,
                0,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null
        );

        service.buscarOverview(filtroPadrao());

        assertThat(sqlRepository.dataReferenciaOverview).isEqualTo(LocalDate.of(2026, 3, 23));
    }

    private static final class FakeFaturasPorClienteSqlRepository extends FaturasPorClienteSqlRepository {

        private FaturasPorClienteOverviewDTO overview;
        private LocalDate dataReferenciaOverview;
        private List<FaturasPorClienteStatusProcessoDTO> status = List.of();
        private List<FaturasPorClienteTopClienteDTO> topClientes = List.of();

        private FakeFaturasPorClienteSqlRepository() {
            super(null, null, null);
        }

        @Override
        public FaturasPorClienteOverviewDTO buscarOverview(FiltroConsultaDTO filtro, LocalDate dataReferencia) {
            this.dataReferenciaOverview = dataReferencia;
            return overview;
        }

        @Override
        public List<FaturasPorClienteStatusProcessoDTO> buscarStatusProcesso(FiltroConsultaDTO filtro) {
            return status;
        }

        @Override
        public List<FaturasPorClienteTopClienteDTO> buscarTopClientes(FiltroConsultaDTO filtro, int limite) {
            return topClientes;
        }
    }

    private static final class FakeDashboardTabelaPaginadaService extends DashboardTabelaPaginadaService {

        private FiltroConsultaDTO filtroTabela;
        private int limiteTabela;
        private List<FaturaPorClienteResumoDTO> tabela = List.of();

        private FakeDashboardTabelaPaginadaService() {
            super(null, null, null, null);
        }

        @Override
        public List<FaturaPorClienteResumoDTO> buscarPrimeiraPaginaFaturasPorCliente(FiltroConsultaDTO filtro, int limite) {
            this.filtroTabela = filtro;
            this.limiteTabela = limite;
            return tabela;
        }
    }

    private static FiltroConsultaDTO filtroPadrao() {
        return new FiltroConsultaDTO(LocalDate.of(2026, 2, 21), LocalDate.of(2026, 3, 23), Map.of());
    }

    private static VisaoFaturasClienteEntity linha(
            String uniqueId,
            String documentoFatura,
            String valorFitAnt,
            String valorFatura,
            String valorFrete,
            String pagadorNome,
            String filial,
            LocalDate emissaoFatura,
            LocalDate vencimento,
            LocalDate baixa,
            LocalDateTime dataExtracao
    ) {
        VisaoFaturasClienteEntity entity = Objects.requireNonNull(novaInstancia(VisaoFaturasClienteEntity.class));
        ReflectionTestUtils.setField(entity, "uniqueId", uniqueId);
        ReflectionTestUtils.setField(entity, "documentoFatura", documentoFatura);
        ReflectionTestUtils.setField(entity, "valorFitAnt", valorFitAnt != null ? new BigDecimal(valorFitAnt) : null);
        ReflectionTestUtils.setField(entity, "valorFatura", valorFatura != null ? new BigDecimal(valorFatura) : null);
        ReflectionTestUtils.setField(entity, "valorFrete", valorFrete != null ? new BigDecimal(valorFrete) : null);
        ReflectionTestUtils.setField(entity, "pagadorNome", pagadorNome);
        ReflectionTestUtils.setField(entity, "filial", filial);
        ReflectionTestUtils.setField(entity, "emissaoFatura", dataTexto(emissaoFatura));
        ReflectionTestUtils.setField(entity, "dataVencimentoFatura", dataTexto(vencimento));
        ReflectionTestUtils.setField(entity, "dataBaixaFatura", dataTexto(baixa));
        ReflectionTestUtils.setField(entity, "dataExtracao", dataHoraTexto(dataExtracao));
        ReflectionTestUtils.setField(entity, "dataEmissaoCte", OffsetDateTime.of(2026, 3, 5, 10, 0, 0, 0, ZoneOffset.UTC));
        ReflectionTestUtils.setField(entity, "numeroCte", 12345L);
        return entity;
    }

    private static <T> T novaInstancia(Class<T> type) {
        try {
            Constructor<T> constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Nao foi possivel instanciar " + type.getSimpleName(), ex);
        }
    }

    private static String dataTexto(LocalDate data) {
        return data != null ? data.toString() : null;
    }

    private static String dataHoraTexto(LocalDateTime data) {
        return data != null ? data.toString() : null;
    }
}
