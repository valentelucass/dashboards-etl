package com.dashboard.api.dto;

import java.time.LocalDate;

public record CoberturaArquivamentosDTO(LocalDate dataInicial, LocalDate dataFinal, long diasCobertos,
        long diasSolicitados, boolean completa) {}
