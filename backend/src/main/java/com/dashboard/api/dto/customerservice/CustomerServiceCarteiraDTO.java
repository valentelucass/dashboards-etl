package com.dashboard.api.dto.customerservice;

public record CustomerServiceCarteiraDTO(String competencia, long versaoAtual, String hashCarteira,
        int grupos, int cnpjs, int adicionados, int removidos, int transferidos, boolean semAlteracao) {
}
