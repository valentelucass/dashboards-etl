package com.dashboard.api.service;

import java.time.LocalDate;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ValidadorPeriodoServiceTest {
    private final ValidadorPeriodoService validator = new ValidadorPeriodoService();

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 364, 365})
    void aceitaLimitesDoIntervaloEmDias(int dias) {
        LocalDate inicio = LocalDate.of(2024, 2, 29);
        assertThatCode(() -> validator.validar(inicio, inicio.plusDays(dias))).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(ints = {-366, -1, 366, 730})
    void rejeitaIntervaloInvertidoOuAcimaDoLimite(int dias) {
        LocalDate inicio = LocalDate.of(2024, 2, 29);
        assertThatThrownBy(() -> validator.validar(inicio, inicio.plusDays(dias)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @MethodSource("datasAusentes")
    void exigeAmbasAsDatas(LocalDate inicio, LocalDate fim) {
        assertThatThrownBy(() -> validator.validar(inicio, fim))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("obrigatórias");
    }

    static Stream<Arguments> datasAusentes() {
        LocalDate data = LocalDate.of(2026, 9, 10);
        return Stream.of(Arguments.of(null, data), Arguments.of(data, null), Arguments.of(null, null));
    }
}
