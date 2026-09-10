package com.dashboard.api.controller;

import com.dashboard.api.exception.ManipuladorGlobalExcecoes;
import com.dashboard.api.security.AcessoSeguranca;
import com.dashboard.api.service.HomeComunicadoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real MVC binding/Bean Validation, without a Spring Boot context, server or database. */
class HttpRequestValidationTest {
    private HomeComunicadoService service;
    private MockMvc mvc;

    @BeforeEach
    void prepare() {
        service = mock(HomeComunicadoService.class);
        mvc = MockMvcBuilders.standaloneSetup(new HomeComunicadoController(service, mock(AcessoSeguranca.class)))
                .setControllerAdvice(new ManipuladorGlobalExcecoes()).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"corpo\":null}", "{\"corpo\":\" \"}"})
    void campoInvalidoRetorna400AntesDeChamarServico(String body) throws Exception {
        mvc.perform(post("/api/painel/home/comunicados/1/comentarios").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("status").value(400));
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{", "{\"corpo\":", "{\"corpo\":{\"segredo\":\"valor-privado\"}}", ""})
    void jsonMalformadoOuTipoIncorretoRetorna400SemExporPayload(String body) throws Exception {
        mvc.perform(post("/api/painel/home/comunicados/1/comentarios").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("status").value(400))
                .andExpect(jsonPath("mensagem").value("Corpo da requisição ausente ou inválido."));
        verifyNoInteractions(service);
    }

    @Test
    void conteudoTextoNaoEhAceitoComoJson() throws Exception {
        mvc.perform(post("/api/painel/home/comunicados/1/comentarios").contentType(MediaType.TEXT_PLAIN).content("texto"))
                .andExpect(status().isUnsupportedMediaType());
        verifyNoInteractions(service);
    }

    @Test
    void comentarioAcimaDoLimiteEhRejeitadoNaBordaHttp() throws Exception {
        mvc.perform(post("/api/painel/home/comunicados/1/comentarios").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"corpo\":\"" + "a".repeat(701) + "\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
