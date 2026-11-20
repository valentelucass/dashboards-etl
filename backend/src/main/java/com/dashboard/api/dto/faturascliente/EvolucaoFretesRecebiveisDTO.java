package com.dashboard.api.dto.faturascliente;

import java.math.BigDecimal;

public record EvolucaoFretesRecebiveisDTO(
        String periodo,
        BigDecimal valorTotalFretes,
        BigDecimal valorFaturado,
        int quantidadeFretes
) {
}
