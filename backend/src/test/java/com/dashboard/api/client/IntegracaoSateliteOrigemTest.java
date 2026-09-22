package com.dashboard.api.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import com.dashboard.api.controller.IntegracoesController;
import com.dashboard.api.service.IntegracoesService;

class IntegracaoSateliteOrigemTest {
    @Test
    void preservaContratoOperacionalSemRecalcularEEncaminhaDetalhamentoPaginado() {
        var server = new AtomicReference<MockRestServiceServer>();
        var builder = new RestTemplateBuilder().additionalCustomizers(
                template -> server.set(MockRestServiceServer.bindTo(template).build()));
        var client = new IntegracaoSateliteClient(builder, "http://satelite.test");
        var controller = new IntegracoesController(new IntegracoesService(client));
        String body = "{\"versao\":3,\"etapas\":[],\"historicoDesde\":null}";
        server.get().expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo(
                org.hamcrest.Matchers.startsWith("http://satelite.test/api/auditoria/integracoes-clientes/indicadores-operacionais?")))
                .andExpect(queryParam("destino", "VEDACIT", "SELIA"))
                .andExpect(queryParam("dataInicial", "2026-09-01"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        server.get().expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo(
                org.hamcrest.Matchers.startsWith("http://satelite.test/api/auditoria/integracoes-clientes/pendencias-etapas?")))
                .andExpect(method(HttpMethod.GET)).andExpect(queryParam("destino", "VEDACIT"))
                .andExpect(queryParam("etapa", "DADOS")).andExpect(queryParam("acao", "AGUARDANDO_ORIGEM"))
                .andExpect(queryParam("pagina", "1")).andExpect(queryParam("tamanho", "25"))
                .andRespond(withSuccess("{\"itens\":[],\"totalElementos\":0}", MediaType.APPLICATION_JSON));
        assertThat(controller.consultarIndicadoresOperacionais("2026-09-01", "2026-09-21", java.util.List.of("VEDACIT", "SELIA")).getBody()).isEqualTo(body);
        assertThat(controller.consultarPendenciasEtapas(java.util.List.of("VEDACIT"), "DADOS", "AGUARDANDO_ORIGEM", 1, 25).getBody()).contains("totalElementos");
        server.get().verify();
    }
    @Test
    void preservaContagensSeparadasEPeriodoPorTodasAsCamadas() {
        var server = new AtomicReference<MockRestServiceServer>();
        var builder = new RestTemplateBuilder().additionalCustomizers(
                template -> server.set(MockRestServiceServer.bindTo(template).build()));
        var client = new IntegracaoSateliteClient(builder, "http://satelite.test");
        String body = "{\"versao\":1,\"etapas\":[{\"etapa\":\"DADOS\",\"sucessosPeriodo\":0},{\"etapa\":\"COMPROVANTE\",\"sucessosPeriodo\":269}]}";
        server.get().expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo(
                    org.hamcrest.Matchers.startsWith("http://satelite.test/api/auditoria/integracoes-clientes/indicadores-etapas?")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("destino", "VEDACIT", "SELIA"))
                .andExpect(queryParam("dataInicial", "2026-09-01"))
                .andExpect(queryParam("dataFinal", "2026-09-10"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        var response = new IntegracoesController(new IntegracoesService(client))
                .consultarIndicadoresEtapas("2026-09-01", "2026-09-10", java.util.List.of("VEDACIT", "SELIA"));
        assertThat(response.getBody()).isEqualTo(body);
        server.get().verify();
    }

    @Test
    void preservaOrigemPaginaEContagemPeloControllerServiceECliente() {
        var server = new AtomicReference<MockRestServiceServer>();
        var builder = new RestTemplateBuilder().additionalCustomizers(
                template -> server.set(MockRestServiceServer.bindTo(template).build()));
        var client = new IntegracaoSateliteClient(builder, "http://satelite.test");
        String body = "{\"itens\":[],\"paginacao\":{\"totalElementos\":0}}";
        server.get().expect(queryParam("origem", "API_ESL"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("pagina", "1"))
                .andExpect(queryParam("tamanho", "10"))
                .andExpect(queryParam("cliente", "VEDACIT"))
                .andExpect(queryParam("dataInicial", "2026-09-01"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        var response = new IntegracoesController(new IntegracoesService(client))
                .consultarExecucoesSftpClientes(1, 10, "VEDACIT", "CONCLUIDO", "2026-09-01", "2026-09-09", "API_ESL");
        assertThat(response.getBody()).isEqualTo(body);
        server.get().verify();
    }
}
