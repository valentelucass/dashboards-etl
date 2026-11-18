package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoContasAPagarEntity;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface VisaoContasAPagarRepository extends JpaRepository<VisaoContasAPagarEntity, Long>,
        JpaSpecificationExecutor<VisaoContasAPagarEntity> {

    List<VisaoContasAPagarEntity> findByEmissaoBetween(LocalDate inicio, LocalDate fim);

    @Query(value = """
            SELECT DISTINCT
                COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Descrição]))), ''), '') AS descricao,
                COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Classificação]))), ''), '') AS classificacao
            FROM dbo.vw_contas_a_pagar_powerbi
            WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Descrição]))), '') IS NOT NULL
               OR NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Classificação]))), '') IS NOT NULL
            ORDER BY descricao
            """, nativeQuery = true)
    List<PlanoContasProjection> findDistinctPlanoContas();

    @Query(value = """
            SELECT DISTINCT
                COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Descrição]))), ''), '') AS descricao,
                COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Classificação]))), ''), '') AS classificacao
            FROM dbo.vw_contas_a_pagar_powerbi
            WHERE (NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Descrição]))), '') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conta Contábil/Classificação]))), '') IS NOT NULL)
              AND LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) IN (:filiais)
            ORDER BY descricao
            """, nativeQuery = true)
    List<PlanoContasProjection> findDistinctPlanoContasByFilialIn(@Param("filiais") List<String> filiais);

    interface PlanoContasProjection {
        String getDescricao();

        String getClassificacao();
    }
}
