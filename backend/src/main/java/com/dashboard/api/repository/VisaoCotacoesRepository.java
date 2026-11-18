package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoCotacoesEntity;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface VisaoCotacoesRepository extends JpaRepository<VisaoCotacoesEntity, Long>,
        JpaSpecificationExecutor<VisaoCotacoesEntity> {

    List<VisaoCotacoesEntity> findByDataCotacaoGreaterThanEqualAndDataCotacaoLessThan(
            OffsetDateTime inicioInclusivo,
            OffsetDateTime fimExclusivo
    );

    @Query(value = """
            SELECT DISTINCT cliente
            FROM (
                SELECT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente Pagador]))), '') AS cliente
                FROM dbo.vw_cotacoes_powerbi
                UNION ALL
                SELECT NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente]))), '') AS cliente
                FROM dbo.vw_cotacoes_powerbi
            ) clientes
            WHERE cliente IS NOT NULL
            ORDER BY cliente
            """, nativeQuery = true)
    List<String> findDistinctClientes();

    @Query(value = """
            SELECT DISTINCT cliente
            FROM (
                SELECT
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente Pagador]))), '') AS cliente,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) AS filial
                FROM dbo.vw_cotacoes_powerbi
                UNION ALL
                SELECT
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Cliente]))), '') AS cliente,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) AS filial
                FROM dbo.vw_cotacoes_powerbi
            ) clientes
            WHERE cliente IS NOT NULL
              AND filial IN (:filiais)
            ORDER BY cliente
            """, nativeQuery = true)
    List<String> findDistinctClientesByFilialIn(@Param("filiais") List<String> filiais);
}
