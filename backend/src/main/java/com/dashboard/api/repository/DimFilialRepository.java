package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.DimFilialEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

@ConsultaAnalitica
public interface DimFilialRepository extends JpaRepository<DimFilialEntity, String> {

    @Query(value = """
            SELECT DISTINCT nome
            FROM (
                SELECT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [NomeFilial]))), '') COLLATE DATABASE_DEFAULT AS nome
                FROM dbo.vw_dim_filiais
                WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [NomeFilial]))), '') IS NOT NULL

                UNION

                SELECT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), filial_performance_key))), '') COLLATE DATABASE_DEFAULT AS nome
                FROM dbo.fato_gestao_vista_fretes
                WHERE indicador_codigo = 'PE'
                  AND is_linha_valida_indicador = 1
                  AND excluido_na_origem = 0
                  AND NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), filial_performance_key))), '') IS NOT NULL
            ) filiais
            WHERE nome IS NOT NULL
            ORDER BY nome
            """, nativeQuery = true)
    List<String> findDistinctNomes();
}
