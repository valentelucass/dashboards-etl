package com.dashboard.api.dto.tracking;

import java.math.BigDecimal;

public record TrackingRegiaoDTO(
        String regiaoDestino,
        BigDecimal pesoTaxado,
        BigDecimal valorFrete,
        BigDecimal valorNota,
        int volumes,
        int foraDoPrazo,
        int totalCargas
) {}
