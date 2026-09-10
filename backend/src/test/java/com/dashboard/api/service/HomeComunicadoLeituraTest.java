package com.dashboard.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.dashboard.api.model.acesso.HomeComunicadoEntity;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.repository.acesso.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.security.access.AccessDeniedException;

class HomeComunicadoLeituraTest {
    private final HomeComunicadoRepository repository = mock(HomeComunicadoRepository.class);
    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final HomeComunicadoService service = new HomeComunicadoService(repository,
            mock(HomeComunicadoCurtidaRepository.class), usuarios, mock(HomeComunicadoComentarioRepository.class));

    private void comunicadoAtivo() {
        var comunicado = new HomeComunicadoEntity();
        comunicado.setId(7L);
        comunicado.setAtivo(true);
        when(repository.findById(7L)).thenReturn(Optional.of(comunicado));
    }

    @Test
    void leituraUsaUsuarioDaSessaoEExatamenteAVersaoAberta() {
        comunicadoAtivo();
        var usuario = new UsuarioEntity();
        usuario.setId(3L);
        when(usuarios.findByEmailIgnoreCaseAndAtivoTrue("pessoa@example.test")).thenReturn(Optional.of(usuario));
        var versao = Instant.parse("2026-09-10T12:00:00.1234567Z");
        service.registrarLeitura(7L, versao, "pessoa@example.test");
        verify(repository).registrarLeitura(3L, 7L, versao);
    }

    @Test
    void usuarioInativoNaoRegistraLeitura() {
        comunicadoAtivo();
        when(usuarios.findByEmailIgnoreCaseAndAtivoTrue("inativo@example.test")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.registrarLeitura(7L, Instant.now(), "inativo@example.test"))
                .isInstanceOf(AccessDeniedException.class);
        verify(repository, never()).registrarLeitura(any(), any(), any());
    }

    @Test
    void comunicadoArquivadoNaoRegistraLeitura() {
        var comunicado = new HomeComunicadoEntity();
        comunicado.setAtivo(false);
        when(repository.findById(7L)).thenReturn(Optional.of(comunicado));
        assertThatThrownBy(() -> service.registrarLeitura(7L, Instant.now(), "pessoa@example.test"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(usuarios);
        verify(repository, never()).registrarLeitura(any(), any(), any());
    }

    @Test
    void consultaRealIsolaLeiturasPorUsuarioEConsideraEdicoesEArquivamento() throws Exception {
        var database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        try {
            var jdbc = new NamedParameterJdbcTemplate(database);
            jdbc.getJdbcTemplate().execute("CREATE SCHEMA acesso");
            jdbc.getJdbcTemplate().execute("CREATE TABLE acesso.home_comunicados (id BIGINT PRIMARY KEY, ativo INT, publicado_em TIMESTAMP(7), atualizado_em TIMESTAMP(7))");
            jdbc.getJdbcTemplate().execute("CREATE TABLE acesso.home_comunicado_leituras (usuario_id BIGINT, comunicado_id BIGINT, versao_lida_em TIMESTAMP(7))");
            jdbc.getJdbcTemplate().execute("""
                    INSERT INTO acesso.home_comunicados VALUES
                    (1, 1, '2026-09-10 10:00:00', NULL),
                    (2, 1, '2026-09-10 10:00:00', '2026-09-10 11:00:00'),
                    (3, 0, '2026-09-10 10:00:00', NULL),
                    (4, 1, '2026-09-10 10:00:00', NULL)
                    """);
            jdbc.getJdbcTemplate().execute("INSERT INTO acesso.home_comunicado_leituras VALUES (9, 1, '2026-09-10 10:00:00'), (9, 2, '2026-09-10 10:00:00')");
            var sql = HomeComunicadoRepository.class.getMethod("listarIdsNaoLidos", Long.class).getAnnotation(Query.class).value();
            assertThat(jdbc.queryForList(sql, Map.of("usuarioId", 9L), Long.class)).containsExactlyInAnyOrder(2L, 4L);
            assertThat(jdbc.queryForList(sql, Map.of("usuarioId", 10L), Long.class)).containsExactlyInAnyOrder(1L, 2L, 4L);
            jdbc.getJdbcTemplate().execute("UPDATE acesso.home_comunicado_leituras SET versao_lida_em = '2026-09-10 11:00:00' WHERE usuario_id = 9 AND comunicado_id = 2");
            assertThat(jdbc.queryForList(sql, Map.of("usuarioId", 9L), Long.class)).isEqualTo(List.of(4L));
        } finally {
            database.shutdown();
        }
    }
}
