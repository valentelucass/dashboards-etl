package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoInventarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@ConsultaAnalitica
public interface VisaoInventarioRepository extends JpaRepository<VisaoInventarioEntity, String>,
        JpaSpecificationExecutor<VisaoInventarioEntity> {
}
