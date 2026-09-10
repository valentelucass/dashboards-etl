package com.dashboard.api.repository.acesso;

import com.dashboard.api.model.acesso.HomeComunicadoEntity;
import java.util.List;
import java.time.Instant;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HomeComunicadoRepository extends JpaRepository<HomeComunicadoEntity, Long> {

    @Query("""
            select comunicado
            from HomeComunicadoEntity comunicado
            where comunicado.ativo = true
            order by
                case when comunicado.tag = 'FIXADO' then 0 else 1 end,
                comunicado.publicadoEm desc,
                comunicado.id desc
            """)
    List<HomeComunicadoEntity> listarAtivosOrdenados();

    @Query(value = """
            SELECT c.id FROM acesso.home_comunicados c
            LEFT JOIN acesso.home_comunicado_leituras l
              ON l.comunicado_id = c.id AND l.usuario_id = :usuarioId
            WHERE c.ativo = 1 AND (
                l.comunicado_id IS NULL OR c.atualizado_em > l.versao_lida_em
                OR (c.atualizado_em IS NULL AND c.publicado_em > l.versao_lida_em)
            )
            """, nativeQuery = true)
    List<Long> listarIdsNaoLidos(@Param("usuarioId") Long usuarioId);

    @Modifying
    @Query(value = """
            MERGE acesso.home_comunicado_leituras WITH (HOLDLOCK) AS destino
            USING (
                SELECT u.id AS usuario_id, c.id AS comunicado_id, :versao AS versao
                FROM acesso.usuarios u CROSS JOIN acesso.home_comunicados c
                WHERE u.id = :usuarioId AND u.ativo = 1 AND c.id = :comunicadoId AND c.ativo = 1
                  AND (c.atualizado_em = :versao OR (c.atualizado_em IS NULL AND c.publicado_em = :versao))
            ) AS origem
            ON destino.usuario_id = origem.usuario_id AND destino.comunicado_id = origem.comunicado_id
            WHEN MATCHED AND destino.versao_lida_em < origem.versao THEN
                UPDATE SET versao_lida_em = origem.versao, lido_em = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (usuario_id, comunicado_id, versao_lida_em, lido_em)
                VALUES (origem.usuario_id, origem.comunicado_id, origem.versao, SYSUTCDATETIME());
            """, nativeQuery = true)
    void registrarLeitura(@Param("usuarioId") Long usuarioId, @Param("comunicadoId") Long comunicadoId,
                         @Param("versao") Instant versao);
}
