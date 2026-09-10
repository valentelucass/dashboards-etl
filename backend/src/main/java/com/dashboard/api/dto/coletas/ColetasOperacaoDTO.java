package com.dashboard.api.dto.coletas;

import java.util.List;

public record ColetasOperacaoDTO(
        List<ColetasRegiaoOrigemDTO> regioesOrigem,
        List<ColetasAgingBucketDTO> agingAbertas
) {}
