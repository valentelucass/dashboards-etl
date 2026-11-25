package com.dashboard.api.dto.sinistros;

import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.*;

public final class SinistrosFormularios {
    private SinistrosFormularios() {}

    public record Acompanhamento(
        @NotBlank @Pattern(regexp="Pendente|Em Andamento|Finalizado") String statusCorretora,
        @PositiveOrZero @Digits(integer=15,fraction=2) BigDecimal franquia,
        @PositiveOrZero @Digits(integer=15,fraction=2) BigDecimal salvados,
        @NotNull @PositiveOrZero Integer revisao) {}

    public record Apolice(
        @NotBlank @Size(max=120) String numero, @NotNull LocalDate inicio, @NotNull LocalDate fim,
        @NotNull @Positive @Digits(integer=15,fraction=2) BigDecimal valorSegurado,
        @NotNull @PositiveOrZero Integer revisao) {}

    public record ApoliceCadastrada(int id,String numero,LocalDate inicio,LocalDate fim,BigDecimal valorSegurado,int revisao) {}
}
