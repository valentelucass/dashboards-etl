package com.dashboard.api.dto.tracking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TrackingFreteDTO(
        Long numeroMinuta,
        List<String> numerosNf,
        String statusCarga,
        LocalDate previsaoEntrega,
        boolean atrasado,
        int volumes,
        BigDecimal pesoTaxado,
        BigDecimal valorFrete,
        BigDecimal valorNota
) {}
