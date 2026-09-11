package com.dashboard.api.dto.acesso;

import java.time.OffsetDateTime;

public record UsuarioOnlineResumoDTO(
        String id,
        String nome,
        String email,
        OffsetDateTime ultimaAtividade,
        String ultimaRotaAcessada
) {
}
