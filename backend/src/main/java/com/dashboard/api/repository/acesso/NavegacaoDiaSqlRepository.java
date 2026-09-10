package com.dashboard.api.repository.acesso;

import com.dashboard.api.dto.acesso.NavegacaoDiaDTO;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class NavegacaoDiaSqlRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public NavegacaoDiaSqlRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Chamado dentro da transação do serviço. O lock no usuário serializa abas e
    // a primeira criação da linha, sem corrida de INSERT ou soma duplicada.
    public void registrar(String operador, String rota, boolean visivel, String fluxoId) {
        jdbc.update("""
                DECLARE @usuario BIGINT;
                SELECT @usuario = id FROM acesso.usuarios WITH (UPDLOCK, HOLDLOCK)
                 WHERE (email = :operador OR login = :operador) AND ativo = 1;
                IF @usuario IS NULL RETURN;
                DECLARE @agora DATETIMEOFFSET(3) = SYSDATETIMEOFFSET();
                DECLARE @dia DATE = CAST(@agora AT TIME ZONE 'E. South America Standard Time' AS DATE);
                IF NOT EXISTS (SELECT 1 FROM acesso.usuario_navegacao_dia WHERE usuario_id = @usuario)
                    INSERT INTO acesso.usuario_navegacao_dia (usuario_id, dia) VALUES (@usuario, @dia);

                DECLARE @visitas NVARCHAR(MAX), @indice INT, @anterior VARCHAR(100),
                        @fluxo VARCHAR(36), @pulso DATETIMEOFFSET(3), @diaAnterior DATE;
                SELECT @visitas = visitas, @indice = indice_atual, @anterior = rota_atual,
                       @fluxo = fluxo_id, @pulso = ultimo_pulso, @diaAnterior = dia
                  FROM acesso.usuario_navegacao_dia WITH (UPDLOCK, HOLDLOCK) WHERE usuario_id = @usuario;
                IF @diaAnterior <> @dia
                BEGIN
                    SET @visitas = N'[]'; SET @indice = -1; SET @anterior = NULL;
                    SET @pulso = NULL; SET @fluxo = NULL;
                END;
                -- Um blur atrasado de outra aba não encerra a aba atualmente ativa.
                IF :visivel = 0 AND (@fluxo IS NULL OR @fluxo <> :fluxoId) RETURN;
                DECLARE @continuo BIT = CASE WHEN @anterior IS NOT NULL
                    AND @pulso >= DATEADD(SECOND, -75, @agora) AND @pulso <= @agora THEN 1 ELSE 0 END;
                IF @continuo = 1
                BEGIN
                    DECLARE @path NVARCHAR(100) = N'$[' + CAST(@indice AS NVARCHAR(12)) + N']';
                    DECLARE @segundos INT = CAST(JSON_VALUE(@visitas, @path + N'.segundos') AS INT)
                        + DATEDIFF(SECOND, @pulso, @agora);
                    SET @visitas = JSON_MODIFY(@visitas, @path + N'.segundos', @segundos);
                    SET @visitas = JSON_MODIFY(@visitas, @path + N'.fim', CONVERT(VARCHAR(33), @agora, 127));
                END;
                IF :visivel = 1 AND (@continuo = 0 OR @anterior <> :rota OR @fluxo <> :fluxoId)
                BEGIN
                    DECLARE @nova NVARCHAR(MAX) = (SELECT :rota AS rota,
                        CONVERT(VARCHAR(33), @agora, 127) AS inicio,
                        CONVERT(VARCHAR(33), @agora, 127) AS fim, 0 AS segundos
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
                    SET @visitas = JSON_MODIFY(@visitas, 'append $', JSON_QUERY(@nova));
                    SET @indice = @indice + 1;
                END;
                UPDATE acesso.usuario_navegacao_dia SET dia = @dia, visitas = @visitas,
                    indice_atual = @indice, ultimo_pulso = @agora,
                    rota_atual = CASE WHEN :visivel = 1 THEN :rota ELSE NULL END,
                    fluxo_id = CASE WHEN :visivel = 1 THEN :fluxoId ELSE NULL END
                 WHERE usuario_id = @usuario;
                IF :visivel = 1
                    UPDATE acesso.usuarios SET ultima_atividade = @agora, ultima_rota_acessada = :rota
                     WHERE id = @usuario;
                """, new MapSqlParameterSource().addValue("operador", operador).addValue("rota", rota)
                .addValue("visivel", visivel).addValue("fluxoId", fluxoId));
    }

    public void limparDiasAnteriores() {
        jdbc.update("""
                UPDATE acesso.usuario_navegacao_dia
                   SET visitas = N'[]', indice_atual = -1, rota_atual = NULL,
                       fluxo_id = NULL, ultimo_pulso = NULL,
                       dia = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE)
                 WHERE dia < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE)
                """, Map.of());
    }

    public NavegacaoDiaDTO buscar(long usuarioId, int pagina) {
        // Uma única leitura captura o documento e seu dia antes da paginação.
        return jdbc.query("""
                DECLARE @dia DATE = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE);
                DECLARE @visitas NVARCHAR(MAX) = N'[]';
                SELECT @visitas = n.visitas FROM acesso.usuario_navegacao_dia n
                  JOIN acesso.usuarios u ON u.id = n.usuario_id AND u.ativo = 1
                 WHERE n.usuario_id = :usuarioId AND n.dia = @dia;
                SELECT CONVERT(VARCHAR(10), @dia, 23) AS dia, (SELECT COUNT_BIG(*) FROM OPENJSON(@visitas)) AS total,
                       pagina.*
                  FROM (SELECT 1 AS unico) base
                  OUTER APPLY (
                    SELECT CAST(j.[key] AS INT) AS ordem, v.* FROM OPENJSON(@visitas) j
                    CROSS APPLY OPENJSON(j.value) WITH (
                        rota VARCHAR(100), inicio VARCHAR(33), fim VARCHAR(33), segundos BIGINT
                    ) v
                    ORDER BY CAST(j.[key] AS INT) DESC
                    OFFSET :offset ROWS FETCH NEXT 10 ROWS ONLY
                  ) pagina
                ORDER BY ordem DESC
                """, new MapSqlParameterSource().addValue("usuarioId", usuarioId).addValue("offset", (long) pagina * 10),
                rs -> {
                    var visitas = new java.util.ArrayList<NavegacaoDiaDTO.Visita>();
                    String dia = null;
                    long total = 0;
                    while (rs.next()) {
                        dia = rs.getString("dia"); total = rs.getLong("total");
                        if (rs.getObject("ordem") != null) visitas.add(new NavegacaoDiaDTO.Visita(
                                rs.getInt("ordem"), rs.getString("rota"), rs.getString("inicio"),
                                rs.getString("fim"), rs.getLong("segundos")));
                    }
                    return new NavegacaoDiaDTO(dia, total, visitas);
                });
    }
}
