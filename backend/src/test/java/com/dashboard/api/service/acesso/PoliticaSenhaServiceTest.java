package com.dashboard.api.service.acesso;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PoliticaSenhaServiceTest {
    private final PoliticaSenhaService policy = new PoliticaSenhaService();

    @ParameterizedTest
    @ValueSource(strings = {"Abcdefghi1!x", "Senha Forte@2026", "Ábçdefghijk1!"})
    void aceitaSenhaNoLimiteOuAcimaComTodasAsCategorias(String senha) {
        assertThatCode(() -> policy.validar(senha)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "Abcdefgh1!x", "abcdefghijk1!", "ABCDEFGHIJK1!", "Abcdefghijkl!", "Abcdefghijk12", "Abcdefghijk1 ", "Abcdefghijk1é"})
    void rejeitaAusenciaComprimentoInsuficienteECategoriasAusentes(String senha) {
        assertThatThrownBy(() -> policy.validar(senha)).isInstanceOf(IllegalArgumentException.class);
    }
}
