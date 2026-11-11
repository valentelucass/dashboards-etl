package com.dashboard.api.dto.etl;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record EtlV2CoberturaDTO(
        String entidade,
        int template,
        int campos,
        Long diasRecebidos,
        Long linhasAtuais,
        LocalDate primeiraData,
        LocalDate ultimaData,
        OffsetDateTime ultimaCaptura,
        String situacao
) {}
