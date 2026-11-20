package com.dashboard.api.dto.faturascliente;

import java.math.BigDecimal;

public record FaturasPorClienteTopClienteDTO(
        String cliente,
        String clienteCnpj,
        BigDecimal valorFaturado,
        BigDecimal valorAFaturar
) {
}
