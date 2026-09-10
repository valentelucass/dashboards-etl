package com.dashboard.api.dto.home;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record HomeComunicadoLeituraRequestDTO(@NotNull Instant versao) {
}
