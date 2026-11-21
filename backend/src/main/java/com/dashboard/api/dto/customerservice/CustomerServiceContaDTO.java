package com.dashboard.api.dto.customerservice;

import java.util.List;

public record CustomerServiceContaDTO(long id, String nome, List<String> documentos) {
    public CustomerServiceContaDTO {
        documentos = List.copyOf(documentos);
    }

    public record Opcao(long id, String nome) {}
}
