package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.DimVeiculoEntity;
import com.dashboard.api.model.DimVeiculoId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface DimVeiculoRepository extends JpaRepository<DimVeiculoEntity, DimVeiculoId> {

    @Query(value = """
            SELECT DISTINCT
                v.[Placa] AS placa,
                v.[TipoVeiculo] AS tipoVeiculo,
                v.[Proprietario] AS proprietario
            FROM dbo.vw_dim_veiculos v
            ORDER BY v.[Placa]
            """, nativeQuery = true)
    List<VeiculoDimProjection> findDistinctVeiculos();

    @Query(value = """
            SELECT DISTINCT
                v.[Placa] AS placa,
                v.[TipoVeiculo] AS tipoVeiculo,
                v.[Proprietario] AS proprietario
            FROM dbo.vw_dim_veiculos v
            WHERE v.[Filial] IN (:filiais)
            ORDER BY v.[Placa]
            """, nativeQuery = true)
    List<VeiculoDimProjection> findDistinctVeiculosByFilialIn(@Param("filiais") List<String> filiais);

    interface VeiculoDimProjection {
        String getPlaca();

        String getTipoVeiculo();

        String getProprietario();
    }
}
