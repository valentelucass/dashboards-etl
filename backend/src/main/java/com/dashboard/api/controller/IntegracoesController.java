package com.dashboard.api.controller;

import com.dashboard.api.service.IntegracoesService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/painel/integracoes")
@PreAuthorize("@acessoSeguranca.podeAcessar('integracoes')")
public class IntegracoesController {

    private final IntegracoesService integracoesService;

    public IntegracoesController(IntegracoesService integracoesService) {
        this.integracoesService = integracoesService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> consultarIntegracoes(
            @RequestParam String escopo,
            @RequestParam(required = false) String dataInicial,
            @RequestParam(required = false) String dataFinal,
            @RequestParam MultiValueMap<String, String> params
    ) {
        ResponseEntity<String> respostaSatelite = integracoesService.consultarIntegracoes(
                params,
                escopo,
                dataInicial,
                dataFinal
        );

        return ResponseEntity
                .status(respostaSatelite.getStatusCode())
                .contentType(respostaSatelite.getHeaders().getContentType() != null
                        ? respostaSatelite.getHeaders().getContentType()
                        : MediaType.APPLICATION_JSON)
                .body(respostaSatelite.getBody());
    }

    @GetMapping(value = "/exportacao", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> exportarIntegracoes(
            @RequestParam String escopo,
            @RequestParam(required = false) String dataInicial,
            @RequestParam(required = false) String dataFinal,
            @RequestParam MultiValueMap<String, String> params
    ) {
        StreamingResponseBody corpo = outputStream -> integracoesService.exportarIntegracoes(
                params, escopo, dataInicial, dataFinal, outputStream
        );
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("integracoes.csv", StandardCharsets.UTF_8).build().toString()
                )
                .body(corpo);
    }

    @GetMapping(value = "/evolucao-diaria", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> consultarEvolucaoDiaria(
            @RequestParam(required = false) String dataInicial,
            @RequestParam(required = false) String dataFinal,
            @RequestParam(required = false) String escopo,
            @RequestParam(required = false) List<String> destino
    ) {
        ResponseEntity<String> respostaSatelite = integracoesService.consultarEvolucaoDiaria(
                dataInicial,
                dataFinal,
                escopo,
                destino
        );

        return ResponseEntity
                .status(respostaSatelite.getStatusCode())
                .contentType(respostaSatelite.getHeaders().getContentType() != null
                        ? respostaSatelite.getHeaders().getContentType()
                        : MediaType.APPLICATION_JSON)
                .body(respostaSatelite.getBody());
    }

    @GetMapping(value = "/resumo-tabelas", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> consultarResumoTabelas(
            @RequestParam(required = false) String dataInicial,
            @RequestParam(required = false) String dataFinal,
            @RequestParam(required = false) List<String> destino
    ) {
        ResponseEntity<String> respostaSatelite = integracoesService.consultarResumoTabelas(
                dataInicial, dataFinal, destino
        );

        return ResponseEntity
                .status(respostaSatelite.getStatusCode())
                .contentType(respostaSatelite.getHeaders().getContentType() != null
                        ? respostaSatelite.getHeaders().getContentType()
                        : MediaType.APPLICATION_JSON)
                .body(respostaSatelite.getBody());
    }

    @GetMapping(value = "/vedacit-sftp/clientes", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> consultarStatusSftpClientes() {
        return encaminharJson(integracoesService.consultarStatusSftpClientes());
    }

    @GetMapping(value = "/vedacit-sftp/execucoes", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> consultarExecucoesSftpClientes(
            @RequestParam(required = false) Integer pagina,
            @RequestParam(required = false) Integer tamanho,
            @RequestParam(required = false) String cliente,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String dataInicial,
            @RequestParam(required = false) String dataFinal
    ) {
        return encaminharJson(integracoesService.consultarExecucoesSftpClientes(
                pagina, tamanho, cliente, status, dataInicial, dataFinal
        ));
    }

    @GetMapping(value = "/logs/{id}/imagem", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public ResponseEntity<String> consultarImagemCanhoto(@PathVariable Long id) {
        ResponseEntity<String> respostaSatelite = integracoesService.consultarImagemCanhoto(id);

        return ResponseEntity
                .status(respostaSatelite.getStatusCode())
                .contentType(respostaSatelite.getHeaders().getContentType() != null
                        ? respostaSatelite.getHeaders().getContentType()
                        : MediaType.TEXT_PLAIN)
                .body(respostaSatelite.getBody());
    }

    private ResponseEntity<String> encaminharJson(ResponseEntity<String> respostaSatelite) {
        return ResponseEntity.status(respostaSatelite.getStatusCode())
                .contentType(respostaSatelite.getHeaders().getContentType() != null
                        ? respostaSatelite.getHeaders().getContentType()
                        : MediaType.APPLICATION_JSON)
                .body(respostaSatelite.getBody());
    }
}
