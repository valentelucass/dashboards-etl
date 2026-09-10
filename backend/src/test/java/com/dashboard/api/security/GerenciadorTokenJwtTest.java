package com.dashboard.api.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.WeakKeyException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GerenciadorTokenJwtTest {
    private static final String SECRET = "somente-testes-chave-local-32-bytes-123456";
    private final GerenciadorTokenJwt tokens = new GerenciadorTokenJwt(SECRET, 15);

    @Test
    void tokenEmitidoPreservaIdentidadeEValidadeContratada() {
        String token = tokens.gerarToken("usuário@example.test");
        var claims = tokens.extrairClaims(token);
        assertThat(tokens.tokenValido(token)).isTrue();
        assertThat(tokens.extrairUsuario(token)).isEqualTo("usuário@example.test");
        assertThat(claims.getExpiration().getTime() - claims.getIssuedAt().getTime()).isEqualTo(900_000);
        assertThat(claims).doesNotContainKeys("senha", "password", "permissoes");
    }

    @Test
    void rejeitaAssinaturaDeOutraChave() {
        String token = new GerenciadorTokenJwt("outra-chave-exclusiva-de-teste-1234567890", 15).gerarToken("admin");
        assertThat(tokens.tokenValido(token)).isFalse();
    }

    @Test
    void rejeitaTokenExpiradoSemEsperarRelogioReal() {
        String token = Jwts.builder().subject("usuario")
                .expiration(Date.from(Instant.parse("2000-01-01T00:00:00Z")))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(tokens.tokenValido(token)).isFalse();
    }

    @Test
    void rejeitaTokenSemAssinatura() {
        assertThat(tokens.tokenValido(Jwts.builder().subject("admin").compact())).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "abc", "a.b.c", "Bearer token", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9."})
    void entradasMalformadasNaoAutenticam(String token) {
        assertThat(tokens.tokenValido(token)).isFalse();
    }

    @Test
    void rejeitaChaveFracaNaInicializacao() {
        assertThatThrownBy(() -> new GerenciadorTokenJwt("curta", 15)).isInstanceOf(WeakKeyException.class);
    }
}
