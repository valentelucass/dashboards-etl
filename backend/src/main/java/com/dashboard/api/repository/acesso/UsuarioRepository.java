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
                   CONVERT(varchar(33), u.ultima_atividade, 127) AS [ultimaAtividade],
                   u.ultima_rota_acessada AS [ultimaRotaAcessada],
                   CAST(CASE
                        WHEN u.ultima_atividade >= DATEADD(MINUTE, -15, SYSDATETIMEOFFSET()) THEN 1
                        ELSE 0
                   END AS bit) AS [online]
            FROM acesso.usuarios u
            JOIN acesso.setores s ON s.id = u.setor_id
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
                   CONVERT(varchar(33), u.ultima_atividade, 127) AS [ultimaAtividade],
                   CAST(NULL AS varchar(100)) AS [ultimaRotaAcessada],
                   CAST(CASE
                        WHEN u.ultima_atividade >= DATEADD(MINUTE, -15, SYSDATETIMEOFFSET()) THEN 1
                        ELSE 0
                   END AS bit) AS [online]
            FROM acesso.usuarios u
            JOIN acesso.setores s ON s.id = u.setor_id
            ORDER BY LOWER(u.nome)
            """, nativeQuery = true)
    List<UsuarioAcessoResumoProjection> findAcessoResumoSemUltimaRota();

    @Query(value = """
            SELECT
                   CAST(COUNT_BIG(1) AS bigint) AS [totalUsuarios],
                   CAST(COALESCE(SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END), 0) AS bigint) AS [usuariosAtivos],
                   CAST(COALESCE(SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END), 0) AS bigint) AS [usuariosInativos],
                   CAST(COALESCE(SUM(CASE
                        WHEN ativo = 1 AND email <> :operador AND login <> :operador
                             AND ultima_atividade >= DATEADD(MINUTE, -15, SYSDATETIMEOFFSET()) THEN 1
                        ELSE 0
                   END), 0) AS bigint) AS [usuariosOnline]
            FROM acesso.usuarios
            """, nativeQuery = true)
    UsuarioSessaoResumoProjection calcularResumoSessoes(@Param("operador") String operador);

    @Query(value = """
            SELECT
                   u.id AS [id],
                   u.nome AS [nome],
                   u.email AS [email],
                   CONVERT(varchar(33), u.ultima_atividade, 127) AS [ultimaAtividade]
            FROM acesso.usuarios u
            WHERE u.ativo = 1 AND u.email <> :operador AND u.login <> :operador
              AND u.ultima_atividade >= DATEADD(MINUTE, -15, SYSDATETIMEOFFSET())
            ORDER BY u.ultima_atividade DESC, LOWER(u.nome)
            """, nativeQuery = true)
    List<UsuarioOnlineResumoProjection> findUsuariosOnlineResumo(@Param("operador") String operador);

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
    }
}
