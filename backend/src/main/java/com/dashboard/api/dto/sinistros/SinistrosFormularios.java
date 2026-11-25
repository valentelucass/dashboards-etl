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

    public enum Campo { statusCorretora, franquia, salvados }

    public record AlteracaoCampo(@NotNull Campo campo, @NotNull @Size(max=18) String valor,
                                @NotNull @PositiveOrZero Integer revisao) {
        @AssertTrue(message="Informe um status válido ou um valor em reais com até duas casas decimais.")
        public boolean isValorValido() {
            if (campo == null || valor == null) return false;
            if (campo == Campo.statusCorretora) return valor.matches("Pendente|Em Andamento|Finalizado");
            return valor.isEmpty() || valor.matches("[0-9]{1,15}(\\.[0-9]{1,2})?");
        }
    }

    public record Apolice(
        @NotBlank @Size(max=120) String numero, @NotNull LocalDate inicio, @NotNull LocalDate fim,
        @NotNull @Positive @Digits(integer=15,fraction=2) BigDecimal valorSegurado,
        @NotNull @PositiveOrZero Integer revisao) {}

    public record ApoliceCadastrada(int id,String numero,LocalDate inicio,LocalDate fim,BigDecimal valorSegurado,int revisao) {}
}
