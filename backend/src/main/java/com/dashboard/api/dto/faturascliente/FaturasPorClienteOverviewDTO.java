package com.dashboard.api.dto.faturascliente;

import java.math.BigDecimal;

public record FaturasPorClienteOverviewDTO(
        String updatedAt,
        BigDecimal valorFaturado,
        int registrosFaturados,
        int aguardandoFaturamento,
        int titulosEmAtraso,
        double prazoMedioDias,
        int clientesAtivos,
        BigDecimal valorAFaturar,
        BigDecimal contasAReceber,
        BigDecimal valorEmAtraso,
        BigDecimal percentualFaturado,
        BigDecimal percentualEmAtraso,
        Double prazoRecebimentoDias,
        Double prazoAteFaturarDias
) {
}
