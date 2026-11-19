package com.dashboard.api.dto.indicadoresgestao;

public record PerformanceEntregaOverviewDTO(
        String updatedAt,
        int totalEntregas,
        int finalizadas,
        int entregasNoPrazo,
        int entregasForaDoPrazo,
        double pctNoPrazo
) {
}
