package com.dashboard.api.dto.acesso;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PresencaNavegacaoRequest(
        @NotBlank @Size(max = 100) String rota,
        @NotNull Boolean visivel,
        @NotBlank @Pattern(regexp = "[a-fA-F0-9\\-]{36}") String fluxoId
) { }
