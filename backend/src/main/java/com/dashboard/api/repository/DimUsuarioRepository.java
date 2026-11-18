package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.DimUsuarioEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface DimUsuarioRepository extends JpaRepository<DimUsuarioEntity, String> {

    @Query(value = """
            SELECT DISTINCT
                u.[User ID] AS userId,
                u.[Nome] AS nome
            FROM dbo.vw_dim_usuarios u
            JOIN (
                SELECT DISTINCT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuario]))), '') AS nome
                FROM dbo.vw_coletas_powerbi
                WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuario]))), '') IS NOT NULL
            ) coletas ON coletas.nome = u.[Nome]
            ORDER BY u.[Nome]
            """, nativeQuery = true)
    List<UsuarioDimProjection> findUsuariosComColetas();

    @Query(value = """
            SELECT DISTINCT
                u.[User ID] AS userId,
                u.[Nome] AS nome
            FROM dbo.vw_dim_usuarios u
            JOIN (
                SELECT DISTINCT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuario]))), '') AS nome
                FROM dbo.vw_coletas_powerbi
                WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Usuario]))), '') IS NOT NULL
                  AND LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) IN (:filiais)
            ) coletas ON coletas.nome = u.[Nome]
            ORDER BY u.[Nome]
            """, nativeQuery = true)
    List<UsuarioDimProjection> findUsuariosComColetasByFilialIn(@Param("filiais") List<String> filiais);

    interface UsuarioDimProjection {
        String getUserId();

        String getNome();
    }
}
