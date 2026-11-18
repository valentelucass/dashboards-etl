package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.DimPlanoContasEntity;
import org.springframework.data.jpa.repository.JpaRepository;

@ConsultaAnalitica
public interface DimPlanoContasRepository extends JpaRepository<DimPlanoContasEntity, String> {
}
