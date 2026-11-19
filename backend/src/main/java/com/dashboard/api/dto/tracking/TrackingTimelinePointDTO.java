package com.dashboard.api.dto.tracking;

public record TrackingTimelinePointDTO(
        String date,
        int pendente,
        int emEntrega,
        int emTransferencia,
        int finalizado,
        int manifestada
) {}
