package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.DimMotoristaId;
import com.dashboard.api.model.DimMotoristaEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface DimMotoristaRepository extends JpaRepository<DimMotoristaEntity, DimMotoristaId> {

    @Query(value = """
            SELECT DISTINCT m.[NomeMotorista]
            FROM dbo.vw_dim_motoristas m
            ORDER BY m.[NomeMotorista]
            """, nativeQuery = true)
    List<String> findDistinctNomes();

    @Query(value = """
            SELECT DISTINCT m.[NomeMotorista]
            FROM dbo.vw_dim_motoristas m
            WHERE m.[Filial] IN (:filiais)
            ORDER BY m.[NomeMotorista]
            """, nativeQuery = true)
    List<String> findDistinctNomesByFilialIn(@Param("filiais") List<String> filiais);
}
