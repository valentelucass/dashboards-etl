package com.dashboard.api.service;

import com.dashboard.api.repository.DimFilialRepository;
import com.dashboard.api.repository.DimMotoristaRepository;
import com.dashboard.api.repository.DimUsuarioRepository;
import com.dashboard.api.repository.DimVeiculoRepository;
import com.dashboard.api.repository.VisaoColetasRepository;
import com.dashboard.api.repository.VisaoContasAPagarRepository;
import com.dashboard.api.repository.VisaoCotacoesRepository;
import com.dashboard.api.repository.VisaoFaturasClienteRepository;
import com.dashboard.api.repository.VisaoFretesRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DimensoesServiceTest {

    @Test
    void listarPagadoresDeFaturasAplicaEscopoSemConsultarOutrosPaineis() {
        var faturasRepository = mock(VisaoFaturasClienteRepository.class);
        var escopoService = mock(EscopoFilialService.class);
        var service = new DimensoesService(null, null, null, null, null, null, null,
                faturasRepository, null, escopoService);
        when(escopoService.escopoAtual()).thenReturn(
                new EscopoFilialService.EscopoFilial(false, List.of(" FILIAL A ")),
                EscopoFilialService.EscopoFilial.semAcesso(),
                EscopoFilialService.EscopoFilial.comAcessoTotal());
        when(faturasRepository.findDistinctPagadoresByFilialIn(List.of("filial a")))
                .thenReturn(List.of("Cliente A"));
        when(faturasRepository.findDistinctPagadores()).thenReturn(List.of("Cliente A", "Cliente B"));

        assertEquals(List.of("Cliente A"), service.listarPagadoresFaturasPorCliente());
        assertEquals(List.of(), service.listarPagadoresFaturasPorCliente());
        assertEquals(List.of("Cliente A", "Cliente B"), service.listarPagadoresFaturasPorCliente());
    }

    @Test
    void listarCnpjsDeFaturasPropagaFalhaDaConsulta() {
        var faturasRepository = mock(VisaoFaturasClienteRepository.class);
        var escopoService = mock(EscopoFilialService.class);
        var service = new DimensoesService(null, null, null, null, null, null, null,
                faturasRepository, null, escopoService);
        when(escopoService.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.comAcessoTotal());
        when(faturasRepository.findDistinctClienteCnpj()).thenThrow(new QueryTimeoutException("prazo excedido"));

        assertThrows(QueryTimeoutException.class, service::listarClientesCnpjFaturasPorCliente);
    }

    @Test
    void listarClientesDeveIgnorarCamposNulosSemGerarErro() throws Exception {
        DimFilialRepository dimFilialRepository = mock(DimFilialRepository.class);
        DimMotoristaRepository dimMotoristaRepository = mock(DimMotoristaRepository.class);
        DimUsuarioRepository dimUsuarioRepository = mock(DimUsuarioRepository.class);
        DimVeiculoRepository dimVeiculoRepository = mock(DimVeiculoRepository.class);
        VisaoColetasRepository coletasRepository = mock(VisaoColetasRepository.class);
        VisaoFretesRepository fretesRepository = mock(VisaoFretesRepository.class);
        VisaoCotacoesRepository cotacoesRepository = mock(VisaoCotacoesRepository.class);
        VisaoFaturasClienteRepository faturasClienteRepository = mock(VisaoFaturasClienteRepository.class);
        VisaoContasAPagarRepository contasAPagarRepository = mock(VisaoContasAPagarRepository.class);

        EscopoFilialService escopoFilialService = new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };

        DimensoesService service = new DimensoesService(
                dimFilialRepository,
                dimMotoristaRepository,
                dimUsuarioRepository,
                dimVeiculoRepository,
                coletasRepository,
                fretesRepository,
                cotacoesRepository,
                faturasClienteRepository,
                contasAPagarRepository,
                escopoFilialService
        );

        when(coletasRepository.findDistinctClientes()).thenReturn(List.of());
        when(cotacoesRepository.findDistinctClientes()).thenReturn(List.of());
        when(faturasClienteRepository.findDistinctClientes()).thenReturn(List.of());
        when(fretesRepository.findDistinctClientes()).thenReturn(Arrays.asList(
                "Cliente Pagador", null, "Destinatario Final", " "
        ));

        List<String> clientes = assertDoesNotThrow(service::listarClientes);

        assertEquals(List.of("Cliente Pagador", "Destinatario Final"), clientes);
    }

    @Test
    void listarFiliaisDeveRetornarNomesEmMaiusculo() {
        DimFilialRepository dimFilialRepository = mock(DimFilialRepository.class);
        DimMotoristaRepository dimMotoristaRepository = mock(DimMotoristaRepository.class);
        DimUsuarioRepository dimUsuarioRepository = mock(DimUsuarioRepository.class);
        DimVeiculoRepository dimVeiculoRepository = mock(DimVeiculoRepository.class);
        VisaoColetasRepository coletasRepository = mock(VisaoColetasRepository.class);
        VisaoFretesRepository fretesRepository = mock(VisaoFretesRepository.class);
        VisaoCotacoesRepository cotacoesRepository = mock(VisaoCotacoesRepository.class);
        VisaoFaturasClienteRepository faturasClienteRepository = mock(VisaoFaturasClienteRepository.class);
        VisaoContasAPagarRepository contasAPagarRepository = mock(VisaoContasAPagarRepository.class);

        EscopoFilialService escopoFilialService = new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return EscopoFilial.comAcessoTotal();
            }
        };

        DimensoesService service = new DimensoesService(
                dimFilialRepository,
                dimMotoristaRepository,
                dimUsuarioRepository,
                dimVeiculoRepository,
                coletasRepository,
                fretesRepository,
                cotacoesRepository,
                faturasClienteRepository,
                contasAPagarRepository,
                escopoFilialService
        );

        when(dimFilialRepository.findDistinctNomes()).thenReturn(Arrays.asList(
                "agu - rodogarcia transportes rodoviarios ltda",
                " AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA ",
                "atf transportes | araraquara",
                " ",
                null,
                "RODOGAR LOCACAO E SERVICOS"
        ));

        List<String> filiais = service.listarFiliais();

        assertEquals(List.of(
                "AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
                "ATF TRANSPORTES | ARARAQUARA",
                "RODOGAR LOCACAO E SERVICOS"
        ), filiais);
    }

    @Test
    void listarFiliaisDeveNormalizarEscopoRestritoEmMaiusculo() {
        DimFilialRepository dimFilialRepository = mock(DimFilialRepository.class);
        DimMotoristaRepository dimMotoristaRepository = mock(DimMotoristaRepository.class);
        DimUsuarioRepository dimUsuarioRepository = mock(DimUsuarioRepository.class);
        DimVeiculoRepository dimVeiculoRepository = mock(DimVeiculoRepository.class);
        VisaoColetasRepository coletasRepository = mock(VisaoColetasRepository.class);
        VisaoFretesRepository fretesRepository = mock(VisaoFretesRepository.class);
        VisaoCotacoesRepository cotacoesRepository = mock(VisaoCotacoesRepository.class);
        VisaoFaturasClienteRepository faturasClienteRepository = mock(VisaoFaturasClienteRepository.class);
        VisaoContasAPagarRepository contasAPagarRepository = mock(VisaoContasAPagarRepository.class);

        EscopoFilialService escopoFilialService = new EscopoFilialService(null, null) {
            @Override
            public EscopoFilial escopoAtual() {
                return new EscopoFilial(false, Arrays.asList(
                        "spo - rodogarcia transportes rodoviarios ltda",
                        " TR RODOGARCIA | AGU ",
                        "spo - rodogarcia transportes rodoviarios ltda"
                ));
            }
        };

        DimensoesService service = new DimensoesService(
                dimFilialRepository,
                dimMotoristaRepository,
                dimUsuarioRepository,
                dimVeiculoRepository,
                coletasRepository,
                fretesRepository,
                cotacoesRepository,
                faturasClienteRepository,
                contasAPagarRepository,
                escopoFilialService
        );

        List<String> filiais = service.listarFiliais();

        assertEquals(List.of(
                "SPO - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
                "TR RODOGARCIA | AGU"
        ), filiais);
    }
}
