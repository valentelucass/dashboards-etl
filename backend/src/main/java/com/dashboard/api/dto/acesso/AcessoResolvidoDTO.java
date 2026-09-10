package com.dashboard.api.dto.acesso;

import java.util.Map;

/** Resultado restrito à chamada atual: não é persistido nem usado como cache de autorização. */
public record AcessoResolvidoDTO(
        String papel,
        boolean administrador,
        boolean escopoFilialTotal,
        Map<String, Boolean> permissoes
) { }
