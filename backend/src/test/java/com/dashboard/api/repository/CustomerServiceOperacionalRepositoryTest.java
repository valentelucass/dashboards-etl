package com.dashboard.api.repository;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceContaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceOperacionalDTO.Coletas;
import com.dashboard.api.dto.CoberturaArquivamentosDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CustomerServiceOperacionalRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final PerformanceDashboardSqlRepository performance = mock(PerformanceDashboardSqlRepository.class);
    private final ColetasAgregadosSqlRepository coletas = mock(ColetasAgregadosSqlRepository.class);
    private final ComprovantesArquivadosRepository arquivos = mock(ComprovantesArquivadosRepository.class);
    private final EscopoFilialService escopo = mock(EscopoFilialService.class);
    private final CustomerServiceOperacionalRepository repo = new CustomerServiceOperacionalRepository(jdbc,performance,coletas,arquivos,escopo);
    private final MapSqlParameterSource params = new MapSqlParameterSource();
    private final CustomerServiceContaDTO conta = new CustomerServiceContaDTO(1, "Teste", List.of("11111111000199"));
    private final LocalDate inicio = LocalDate.of(2026,11,1), corte = inicio.plusDays(2);
    private final FiltroConsultaDTO periodo = new FiltroConsultaDTO(inicio, inicio.plusDays(30), Map.of());

    @BeforeEach
    void preparar() {
        var filial = new EscopoFilialService.EscopoFilial(false, List.of("AGU"));
        when(escopo.escopoAtual()).thenReturn(filial);
        when(performance.entregasDoCliente(eq(periodo), eq(filial), anyString()))
                .thenReturn(new PerformanceDashboardSqlRepository.ConsultaEntregas("WITH entregas_cliente AS (...) ",params));
        when(coletas.desempenhoDoCliente(eq(periodo), anyString())).thenReturn(new Coletas(0,0));
        when(jdbc.query(anyString(), same(params), any(ResultSetExtractor.class))).thenAnswer(call ->
                call.<ResultSetExtractor<?>>getArgument(2).extractData(mock(ResultSet.class)));
    }

    @Test
    void permiteSomenteCnpjsCompletosEAsMascarasEquivalentes() {
        assertThat(CustomerServiceDocumentos.json(conta.documentos(), true))
                .isEqualTo("[\"11111111000199\",\"11.111.111/0001-99\"]");
        assertThat(CustomerServiceDocumentos.json(List.of("AB12CD3400EF07"), true))
                .isEqualTo("[\"AB12CD3400EF07\",\"AB.12C.D34/00EF-07\"]");
        for (var invalido : List.of(List.<String>of(), List.of("11111111"), List.of("Nome"), List.of("%"))) {
            assertThatThrownBy(() -> CustomerServiceDocumentos.json(invalido, true))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void coberturaIncompletaNaoViraAusenciaDeOcorrenciasOuArquivamentos() {
        when(arquivos.coberturaArquivos(inicio,corte)).thenReturn(new CoberturaArquivamentosDTO(inicio,corte,2,3,false));
        when(jdbc.queryForObject(contains("customer_service_cobertura_ocorrencias"), same(params), eq(Long.class))).thenReturn(2L);
        var dados = repo.consultar(periodo,conta,corte);
        assertThat(dados.arquivadas()).isNull();
        assertThat(dados.avarias()).isNull();
        assertThat(dados.extravios()).isNull();
        assertThat(dados.ocorrenciasPorTipo()).isNull();
        verify(jdbc,never()).query(contains("JOIN dbo.rede_credenciada_arquivos"),same(params),any(ResultSetExtractor.class));
        verify(jdbc,never()).query(contains("FROM dbo.dashboard_performance_ocorrencias"),same(params),any(ResultSetExtractor.class));
    }

    @Test
    void validaProprietarioEFilialEmTodasAsLinhasAntesDeVincularArquivosEEventos() {
        when(arquivos.coberturaArquivos(inicio,corte)).thenReturn(new CoberturaArquivamentosDTO(inicio,corte,3,3,true));
        when(jdbc.queryForObject(contains("customer_service_cobertura_ocorrencias"), same(params), eq(Long.class))).thenReturn(3L);
        var dados = repo.consultar(periodo,conta,corte);
        assertThat(dados.ocorrenciasPorTipo()).isEmpty();
        assertThat(dados.avarias()).isZero();
        var consultas = ArgumentCaptor.forClass(String.class);
        verify(jdbc,times(2)).query(consultas.capture(),same(params),any(ResultSetExtractor.class));
        assertThat(consultas.getAllValues()).allSatisfy(sql -> assertThat(sql).contains("conta.documento = f.[Pagador Doc]",
                "HAVING MIN(CASE WHEN conta.documento IS NOT NULL",
                "f.[Responsável Região Destino Key] IN (:filiaisDaConta)", "THEN 1 ELSE 0 END) = 1"));
        assertThat(consultas.getAllValues().get(0)).contains("LEFT JOIN titulares", "ON a.minuta=t.minuta")
                .doesNotContain("primeiro_arquivamento", ":corteExclusivo");
        assertThat(consultas.getAllValues().get(1)).contains("COUNT_BIG(DISTINCT CASE WHEN classe IS NOT NULL THEN minuta END)",
                "o.ocorrido_em<:corteExclusivo", "JOIN titulares", "o.codigo IN (:tratativas) OR o.codigo IN (:finalizacoes)");
        assertThat(params.getValue("filiaisDaConta")).isEqualTo(List.of("AGU"));
        assertThat(params.getValue("corteExclusivo")).isEqualTo(corte.plusDays(1));
    }

    @Test
    void arquivamentoAtualPodeOcorrerDepoisDoPeriodoDasEntregas() {
        var historico = new FiltroConsultaDTO(inicio, corte, Map.of());
        var hoje = inicio.plusDays(10);
        var ultimaPublicacao = hoje.minusDays(1);
        when(performance.entregasDoCliente(eq(historico), any(), anyString()))
                .thenReturn(new PerformanceDashboardSqlRepository.ConsultaEntregas("WITH entregas_cliente AS (...) ",params));
        when(coletas.desempenhoDoCliente(eq(historico), anyString())).thenReturn(new Coletas(0,0));
        when(arquivos.coberturaArquivos(inicio,hoje)).thenReturn(new CoberturaArquivamentosDTO(inicio,ultimaPublicacao,10,11,false));
        repo.consultar(historico,conta,hoje);
        verify(jdbc).query(contains("LEFT JOIN dbo.rede_credenciada_arquivos a ON a.minuta=t.minuta"),
                same(params),any(ResultSetExtractor.class));
        assertThat(params.getValue("corteExclusivo")).isEqualTo(corte.plusDays(1));

        clearInvocations(jdbc);
        when(arquivos.coberturaArquivos(inicio,hoje)).thenReturn(new CoberturaArquivamentosDTO(inicio,ultimaPublicacao,9,11,false));
        repo.consultar(historico,conta,hoje);
        verify(jdbc,never()).query(contains("JOIN dbo.rede_credenciada_arquivos"),same(params),any(ResultSetExtractor.class));
    }

    @Test
    void usaAcaoDoCadastroESeparaAvariasEExtraviosConfirmadosDeCarga() {
        when(arquivos.coberturaArquivos(inicio,corte)).thenReturn(new CoberturaArquivamentosDTO(inicio,corte,3,3,true));
        when(jdbc.queryForObject(contains("customer_service_cobertura_ocorrencias"), same(params), eq(Long.class))).thenReturn(3L);
        repo.consultar(periodo,conta,corte);

        @SuppressWarnings("unchecked")
        var tratativas = (List<Integer>) params.getValue("tratativas");
        @SuppressWarnings("unchecked")
        var finalizacoes = (List<Integer>) params.getValue("finalizacoes");
        assertThat(tratativas).hasSize(88).doesNotHaveDuplicates().contains(36,65,505,506).doesNotContain(22,127,138);
        assertThat(finalizacoes).hasSize(19).doesNotHaveDuplicates().contains(1,138).doesNotContain(22,127);
        assertThat(tratativas).doesNotContainAnyElementsOf(finalizacoes);
        assertThat(params.getValue("avariasCarga")).isEqualTo(List.of(38,78,79));
        assertThat(params.getValue("extraviosCarga")).isEqualTo(List.of(23,37,80,81));
    }
}
