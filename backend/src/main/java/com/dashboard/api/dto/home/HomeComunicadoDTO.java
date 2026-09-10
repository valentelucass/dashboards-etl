package com.dashboard.api.dto.home;

import java.time.Instant;
import java.util.List;

public record HomeComunicadoDTO(
        String id,
        String titulo,
        String corpo,
        String tag,
        String publicoAlvo,
        Instant publicadoEm,
        String atualizadoPor,
        Instant atualizadoEm,
        long totalCurtidas,
        long totalComentarios,
        List<String> curtidoPor,
        boolean curtidoPeloUsuarioAtual,
        boolean naoLido
) {
}
