package com.dashboard.api.dto.tracking;

import java.math.BigDecimal;

public record TrackingMatrizRegiaoDTO(
        String siglaRegiaoDestino,
        String responsavelRegiaoDestino,
        BigDecimal pesoTaxado,
        BigDecimal valorFrete,
        BigDecimal valorNota,
        int volumes,
        int foraDoPrazo,
        int totalCargas
) {
}
