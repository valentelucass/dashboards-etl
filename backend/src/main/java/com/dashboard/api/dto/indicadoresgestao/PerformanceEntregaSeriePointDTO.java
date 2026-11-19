package com.dashboard.api.dto.indicadoresgestao;

public record PerformanceEntregaSeriePointDTO(
        String label,
        String filtro,
        NivelVisaoPerformance visao,
        int totalEntregas,
        int finalizadas,
        int entregasNoPrazo,
        int entregasForaDoPrazo,
        double pctNoPrazo
) {
}
