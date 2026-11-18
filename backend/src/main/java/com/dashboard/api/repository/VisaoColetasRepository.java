package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoColetasEntity;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface VisaoColetasRepository extends JpaRepository<VisaoColetasEntity, String>,
        JpaSpecificationExecutor<VisaoColetasEntity> {

    List<VisaoColetasEntity> findBySolicitacaoBetween(LocalDate inicio, LocalDate fim);

    @Query(value = """
            SELECT DISTINCT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente]))), '') AS cliente
            FROM dbo.vw_coletas_powerbi
            WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente]))), '') IS NOT NULL
            ORDER BY cliente
            """, nativeQuery = true)
    List<String> findDistinctClientes();

    @Query(value = """
            SELECT DISTINCT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente]))), '') AS cliente
            FROM dbo.vw_coletas_powerbi
            WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente]))), '') IS NOT NULL
              AND LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) IN (:filiais)
            ORDER BY cliente
            """, nativeQuery = true)
    List<String> findDistinctClientesByFilialIn(@Param("filiais") List<String> filiais);
}
