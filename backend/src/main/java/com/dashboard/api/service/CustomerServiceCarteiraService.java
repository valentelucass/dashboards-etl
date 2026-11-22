package com.dashboard.api.service;

import com.dashboard.api.dto.customerservice.CustomerServiceCarteiraDTO;
import com.dashboard.api.repository.CustomerServiceCarteiraRepository;
import com.dashboard.api.repository.CustomerServiceCarteiraRepository.Mudancas;
import com.dashboard.api.repository.CustomerServiceCarteiraRepository.Revisao;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerServiceCarteiraService {
    private final CustomerServiceCarteiraRepository repositorio;
    private final ObjectMapper mapper;

    public CustomerServiceCarteiraService(CustomerServiceCarteiraRepository repositorio, ObjectMapper mapper) {
        this.repositorio = repositorio;
        this.mapper = mapper;
    }

    @Transactional
    public CustomerServiceCarteiraDTO previa(Map<String, String> documentos, String competencia) {
        var carteira = preparar(documentos, competencia);
        var atual = repositorio.bloquearRevisao();
        conferirCompetencia(carteira, atual);
        var mudancas = repositorio.comparar(carteira.json);
        return resultado(carteira, atual.versao(), mudancas, mudancas.mesmaComposicao());
    }

    @Transactional
    public CustomerServiceCarteiraDTO aplicar(Map<String, String> documentos, String competencia,
            long versaoEsperada, String hashEsperado, String responsavel) {
        var carteira = preparar(documentos, competencia);
        if (!carteira.hash.equals(hashEsperado)) {
            throw new IllegalStateException("O arquivo ou a competência mudou. Confira uma nova prévia.");
        }
        var atual = repositorio.bloquearRevisao();
        conferirCompetencia(carteira, atual);
        var mudancas = repositorio.comparar(carteira.json);
        if (carteira.hash.equals(atual.hash()) && carteira.mes.atDay(1).equals(atual.competencia())
                && mudancas.mesmaComposicao()) {
            return resultado(carteira, atual.versao(), mudancas, true);
        }
        if (atual.versao() != versaoEsperada) {
            throw new IllegalStateException("Outro administrador atualizou a carteira. Confira uma nova prévia.");
        }
        var resultado = resultado(carteira, atual.versao() + 1, mudancas, mudancas.mesmaComposicao());
        repositorio.substituir(carteira.json);
        repositorio.registrar(resultado, carteira.mes.atDay(1), responsavel);
        return resultado;
    }

    private record Carteira(YearMonth mes, String json, String hash) {}

    private Carteira preparar(Map<String, String> documentos, String competencia) {
        if (competencia == null || !competencia.matches("[0-9]{4}-[0-9]{2}") || competencia.startsWith("0000-")) {
            throw new IllegalArgumentException("Informe a competência no formato AAAA-MM.");
        }
        YearMonth mes;
        try {
            mes = YearMonth.parse(competencia);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Informe uma competência válida.");
        }
        if (documentos == null || documentos.isEmpty()) throw new IllegalArgumentException("A carteira está vazia.");
        var ordenados = new TreeMap<>(documentos);
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            atualizarHash(digest, competencia);
            ordenados.forEach((cnpj, grupo) -> {
                atualizarHash(digest, cnpj);
                atualizarHash(digest, grupo);
            });
            return new Carteira(mes, mapper.writeValueAsString(ordenados), HexFormat.of().formatHex(digest.digest()));
        } catch (JsonProcessingException | NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Falha ao preparar a importação.", ex);
        }
    }

    private static void atualizarHash(MessageDigest digest, String campo) {
        digest.update(campo.getBytes(StandardCharsets.UTF_8));
        digest.update((byte) 0);
    }

    private static void conferirCompetencia(Carteira carteira, Revisao atual) {
        if (atual.competencia() != null && carteira.mes.atDay(1).isBefore(atual.competencia())) {
            throw new IllegalStateException("A competência é anterior à última carteira importada.");
        }
    }

    private static CustomerServiceCarteiraDTO resultado(Carteira carteira, long versao, Mudancas mudancas,
            boolean semAlteracao) {
        return new CustomerServiceCarteiraDTO(carteira.mes.toString(), versao, carteira.hash, mudancas.grupos(),
                mudancas.cnpjs(), mudancas.adicionados(), mudancas.removidos(), mudancas.transferidos(), semAlteracao);
    }
}
