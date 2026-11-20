package com.dashboard.api.dto.faturascliente;

import java.math.BigDecimal;

public record ClienteEmAtrasoDTO(
        String cliente,
        String clienteCnpj,
        int titulos,
        int maiorAtrasoDias,
        BigDecimal valorEmAtraso
) {
}
