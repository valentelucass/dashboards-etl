package com.dashboard.api.client;

import java.net.URI;
import java.io.OutputStream;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class IntegracaoSateliteClient {

    private static final String ROTA_INTEGRACOES_CLIENTES = "/api/auditoria/integracoes-clientes";
    private static final String ROTA_INTEGRACOES_CLIENTES_EXPORTACAO = ROTA_INTEGRACOES_CLIENTES + "/exportacao";
    private static final String ROTA_EVOLUCAO_DIARIA = "/api/auditoria/integracoes-clientes/evolucao-diaria";
    private static final String ROTA_RESUMO_TABELAS = "/api/auditoria/integracoes-clientes/resumo-tabelas";
    private static final String ROTA_SFTP_CLIENTES = "/api/auditoria/vedacit-sftp/clientes";
    private static final String ROTA_SFTP_EXECUCOES = "/api/auditoria/vedacit-sftp/execucoes";
    private static final String ROTA_IMAGEM_LOG = "/api/auditoria/logs/{id}/imagem";

    private final RestTemplate restTemplate;
    private final String sateliteBaseUrl;

    public IntegracaoSateliteClient(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${app.integration.satelite.url}") String sateliteBaseUrl
    ) {
        this.sateliteBaseUrl = normalizarBaseUrl(sateliteBaseUrl);
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(30))
                .errorHandler(new DefaultResponseErrorHandler() {
                    @Override
                    public boolean hasError(ClientHttpResponse response) {
                        return false;
                    }
                })
                .build();
    }

    public ResponseEntity<String> buscarIntegracoesClientes(
            MultiValueMap<String, String> parametros,
            String escopo,
            String dataInicial,
            String dataFinal
    ) {
        MultiValueMap<String, String> parametrosSatelite = new LinkedMultiValueMap<>();
        if (parametros != null) {
            parametrosSatelite.addAll(parametros);
        }
        parametrosSatelite.set("escopo", escopo);
        adicionarParametroOpcional(parametrosSatelite, "dataInicial", dataInicial);
        adicionarParametroOpcional(parametrosSatelite, "dataFinal", dataFinal);

        URI uri = UriComponentsBuilder
                .fromUriString(sateliteBaseUrl + ROTA_INTEGRACOES_CLIENTES)
                .queryParams(parametrosSatelite)
                .build()
                .encode()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public ResponseEntity<String> buscarEvolucaoDiaria(
            String dataInicial,
            String dataFinal,
            String escopo,
            List<String> destinos
    ) {
        MultiValueMap<String, String> parametrosSatelite = new LinkedMultiValueMap<>();
        adicionarParametroOpcional(parametrosSatelite, "dataInicial", dataInicial);
        adicionarParametroOpcional(parametrosSatelite, "dataFinal", dataFinal);
        adicionarParametroOpcional(parametrosSatelite, "escopo", escopo);
        if (destinos != null && !destinos.isEmpty()) {
            parametrosSatelite.put("destino", destinos);
        }

        URI uri = UriComponentsBuilder
                .fromUriString(sateliteBaseUrl + ROTA_EVOLUCAO_DIARIA)
                .queryParams(parametrosSatelite)
                .build()
                .encode()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public void exportarIntegracoesClientes(
            MultiValueMap<String, String> parametros,
            String escopo,
            String dataInicial,
            String dataFinal,
            OutputStream outputStream
    ) {
        MultiValueMap<String, String> parametrosSatelite = new LinkedMultiValueMap<>();
        if (parametros != null) {
            parametrosSatelite.addAll(parametros);
        }
        parametrosSatelite.set("escopo", escopo);
        adicionarParametroOpcional(parametrosSatelite, "dataInicial", dataInicial);
        adicionarParametroOpcional(parametrosSatelite, "dataFinal", dataFinal);

        executarExportacao(ROTA_INTEGRACOES_CLIENTES_EXPORTACAO, parametrosSatelite, outputStream);
    }

    public ResponseEntity<String> buscarResumoTabelas(String dataInicial, String dataFinal, List<String> destinos) {
        MultiValueMap<String, String> parametrosSatelite = new LinkedMultiValueMap<>();
        adicionarParametroOpcional(parametrosSatelite, "dataInicial", dataInicial);
        adicionarParametroOpcional(parametrosSatelite, "dataFinal", dataFinal);
        if (destinos != null && !destinos.isEmpty()) {
            parametrosSatelite.put("destino", destinos);
        }

        URI uri = UriComponentsBuilder
                .fromUriString(sateliteBaseUrl + ROTA_RESUMO_TABELAS)
                .queryParams(parametrosSatelite)
                .build()
                .encode()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public ResponseEntity<String> buscarStatusSftpClientes() {
        URI uri = UriComponentsBuilder.fromUriString(sateliteBaseUrl + ROTA_SFTP_CLIENTES).build().encode().toUri();
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public ResponseEntity<String> buscarExecucoesSftpClientes(
            Integer pagina, Integer tamanho, String cliente, String status, String dataInicial, String dataFinal
    ) {
        MultiValueMap<String, String> parametros = new LinkedMultiValueMap<>();
        if (pagina != null) parametros.set("pagina", String.valueOf(Math.max(0, pagina)));
        if (tamanho != null) parametros.set("tamanho", String.valueOf(Math.max(1, Math.min(tamanho, 500))));
        adicionarParametroOpcional(parametros, "cliente", cliente);
        adicionarParametroOpcional(parametros, "status", status);
        adicionarParametroOpcional(parametros, "dataInicial", dataInicial);
        adicionarParametroOpcional(parametros, "dataFinal", dataFinal);
        URI uri = UriComponentsBuilder.fromUriString(sateliteBaseUrl + ROTA_SFTP_EXECUCOES)
                .queryParams(parametros).build().encode().toUri();
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public ResponseEntity<String> buscarImagemLog(Long id) {
        URI uri = UriComponentsBuilder
                .fromUriString(sateliteBaseUrl + ROTA_IMAGEM_LOG)
                .buildAndExpand(id)
                .encode()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON, MediaType.TEXT_PLAIN, MediaType.ALL));

        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private void executarExportacao(
            String rota,
            MultiValueMap<String, String> parametros,
            OutputStream outputStream
    ) {
        URI uri = UriComponentsBuilder
                .fromUriString(sateliteBaseUrl + rota)
                .queryParams(parametros)
                .build()
                .encode()
                .toUri();

        restTemplate.execute(uri, HttpMethod.GET, request ->
                        request.getHeaders().setAccept(List.of(MediaType.parseMediaType("text/csv"))),
                response -> {
                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new ResponseStatusException(
                                response.getStatusCode(),
                                "Falha ao solicitar a exportacao ao Satelite."
                        );
                    }
                    StreamUtils.copy(response.getBody(), outputStream);
                    return null;
                }
        );
    }

    private String normalizarBaseUrl(String valor) {
        String url = valor == null ? "" : valor.trim();
        if (url.isEmpty()) {
            throw new IllegalArgumentException("Configure app.integration.satelite.url para habilitar o proxy do Satelite.");
        }
        return url.replaceAll("/+$", "");
    }

    private void adicionarParametroOpcional(MultiValueMap<String, String> parametros, String nome, String valor) {
        if (valor != null && !valor.isBlank()) {
            parametros.set(nome, valor);
        }
    }
}
