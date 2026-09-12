package com.dashboard.api.repository.acesso;

import com.dashboard.api.model.acesso.UsuarioEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {
    Optional<UsuarioEntity> findByEmailIgnoreCase(String email);

    Optional<UsuarioEntity> findByEmailIgnoreCaseAndAtivoTrue(String email);

    boolean existsByLoginIgnoreCase(String login);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByLoginIgnoreCaseAndIdNot(String login, Long id);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    long countBySetorId(Long setorId);

    @Query("SELECT COUNT(u) FROM UsuarioEntity u JOIN UsuarioPapelVinculo v ON v.usuario = u JOIN PapelEntity p ON v.papel = p WHERE p.nome IN :papeis AND u.ativo = true")
    long countAdminsAtivosPorPapeis(@Param("papeis") Collection<String> papeis);

    @Query(value = """
            SELECT
                   u.id AS [id],
                   u.nome AS [nome],
                   u.email AS [email],
                   u.ativo AS [ativo],
                   s.id AS [setorId],
                   s.nome AS [setorNome],
                   u.algoritmo_hash AS [algoritmoHash],
                   u.password_reset_requested_at AS [passwordResetRequestedAt],
                   CONVERT(varchar(33), COALESCE(n.ultimo_pulso, u.ultima_atividade), 127) AS [ultimaAtividade],
                   u.ultima_rota_acessada AS [ultimaRotaAcessada],
                   CAST(CASE
                        WHEN u.ativo = 1 AND n.rota_atual IS NOT NULL
                             AND n.ultimo_pulso >= DATEADD(SECOND, -75, SYSDATETIMEOFFSET())
                             AND n.ultimo_pulso <= SYSDATETIMEOFFSET() THEN 1
                        ELSE 0
                   END AS bit) AS [online]
            FROM acesso.usuarios u
            JOIN acesso.setores s ON s.id = u.setor_id
            LEFT JOIN acesso.usuario_navegacao_dia n ON n.usuario_id = u.id
            ORDER BY LOWER(u.nome)
            """, nativeQuery = true)
    List<UsuarioAcessoResumoProjection> findAcessoResumo();

    @Query(value = """
            SELECT
                   u.id AS [id],
                   u.nome AS [nome],
                   u.email AS [email],
                   u.ativo AS [ativo],
                   s.id AS [setorId],
                   s.nome AS [setorNome],
                   u.algoritmo_hash AS [algoritmoHash],
                   u.password_reset_requested_at AS [passwordResetRequestedAt],
                   CONVERT(varchar(33), COALESCE(n.ultimo_pulso, u.ultima_atividade), 127) AS [ultimaAtividade],
                   CAST(NULL AS varchar(100)) AS [ultimaRotaAcessada],
                   CAST(CASE
                        WHEN u.ativo = 1 AND n.rota_atual IS NOT NULL
                             AND n.ultimo_pulso >= DATEADD(SECOND, -75, SYSDATETIMEOFFSET())
                             AND n.ultimo_pulso <= SYSDATETIMEOFFSET() THEN 1
                        ELSE 0
                   END AS bit) AS [online]
            FROM acesso.usuarios u
            JOIN acesso.setores s ON s.id = u.setor_id
            LEFT JOIN acesso.usuario_navegacao_dia n ON n.usuario_id = u.id
            ORDER BY LOWER(u.nome)
            """, nativeQuery = true)
    List<UsuarioAcessoResumoProjection> findAcessoResumoSemUltimaRota();

    @Query(value = "SELECT CONVERT(varchar(33), SYSDATETIMEOFFSET(), 127)", nativeQuery = true)
    String agoraPresenca();

    @Query(value = """
            SELECT
                   CAST(COUNT_BIG(1) AS bigint) AS [totalUsuarios],
                   CAST(COALESCE(SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END), 0) AS bigint) AS [usuariosAtivos],
                   CAST(COALESCE(SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END), 0) AS bigint) AS [usuariosInativos],
                   CAST(COALESCE(SUM(CASE
                        WHEN u.ativo = 1 AND u.email <> :operador AND u.login <> :operador
                             AND n.rota_atual IS NOT NULL
                             AND n.ultimo_pulso >= DATEADD(SECOND, -75, CAST(:agora AS DATETIMEOFFSET))
                             AND n.ultimo_pulso <= CAST(:agora AS DATETIMEOFFSET) THEN 1
                        ELSE 0
                   END), 0) AS bigint) AS [usuariosOnline]
            FROM acesso.usuarios u
            LEFT JOIN acesso.usuario_navegacao_dia n ON n.usuario_id = u.id
            """, nativeQuery = true)
    UsuarioSessaoResumoProjection calcularResumoSessoes(@Param("operador") String operador, @Param("agora") String agora);

    @Query(value = """
            SELECT
                   u.id AS [id],
                   u.nome AS [nome],
                   u.email AS [email],
                   CONVERT(varchar(33), n.ultimo_pulso, 127) AS [ultimaAtividade],
                   n.rota_atual AS [ultimaRotaAcessada]
            FROM acesso.usuarios u
            JOIN acesso.usuario_navegacao_dia n ON n.usuario_id = u.id
            WHERE u.ativo = 1 AND u.email <> :operador AND u.login <> :operador
              AND n.rota_atual IS NOT NULL
              AND n.ultimo_pulso >= DATEADD(SECOND, -75, CAST(:agora AS DATETIMEOFFSET))
              AND n.ultimo_pulso <= CAST(:agora AS DATETIMEOFFSET)
            ORDER BY n.ultimo_pulso DESC, LOWER(u.nome)
            """, nativeQuery = true)
    List<UsuarioOnlineResumoProjection> findUsuariosOnlineResumo(@Param("operador") String operador, @Param("agora") String agora);

    @Query(value = """
            SELECT TOP (12) u.id AS [id], u.nome AS [nome], u.email AS [email],
                   CONVERT(varchar(33), n.ultimo_pulso, 127) AS [ultimaAtividade],
                   COALESCE(n.rota_atual, JSON_VALUE(n.visitas,
                       CASE WHEN n.indice_atual >= 0 THEN CONCAT('$[', n.indice_atual, '].rota') ELSE '$.rota' END)) AS [ultimaRotaAcessada]
            FROM acesso.usuarios u
            LEFT JOIN acesso.usuario_navegacao_dia n ON n.usuario_id = u.id
            WHERE u.ativo = 1 AND u.email <> :operador AND u.login <> :operador
              AND n.ultimo_pulso >= DATEADD(DAY, -1, CAST(:agora AS DATETIMEOFFSET))
              AND n.ultimo_pulso <= CAST(:agora AS DATETIMEOFFSET)
              AND NOT EXISTS (
                  SELECT 1 FROM acesso.usuario_navegacao_dia p
                  WHERE p.usuario_id = u.id AND p.rota_atual IS NOT NULL
                    AND p.ultimo_pulso >= DATEADD(SECOND, -75, CAST(:agora AS DATETIMEOFFSET))
                    AND p.ultimo_pulso <= CAST(:agora AS DATETIMEOFFSET)
              )
            ORDER BY n.ultimo_pulso DESC, LOWER(u.nome)
            """, nativeQuery = true)
    List<UsuarioOnlineResumoProjection> findUsuariosRecentesResumo(@Param("operador") String operador, @Param("agora") String agora);

    @Query(value = """
            SELECT CAST(CASE
                   WHEN COL_LENGTH(N'acesso.usuarios', N'ultima_rota_acessada') IS NULL THEN 0
                   ELSE 1
            END AS bit)
            """, nativeQuery = true)
    Boolean existeColunaUltimaRotaAcessada();

    interface UsuarioAcessoResumoProjection {
        Long getId();
        String getNome();
        String getEmail();
        Boolean getAtivo();
        Long getSetorId();
        String getSetorNome();
        String getAlgoritmoHash();
        java.time.Instant getPasswordResetRequestedAt();
        String getUltimaAtividade();
        String getUltimaRotaAcessada();
        Boolean getOnline();
    }

    interface UsuarioSessaoResumoProjection {
        Long getTotalUsuarios();
        Long getUsuariosAtivos();
        Long getUsuariosInativos();
        Long getUsuariosOnline();
    }

    interface UsuarioOnlineResumoProjection {
        Long getId();
        String getNome();
        String getEmail();
        String getUltimaAtividade();
        String getUltimaRotaAcessada();
    }
}
