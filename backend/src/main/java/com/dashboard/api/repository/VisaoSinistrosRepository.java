package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoSinistrosEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@ConsultaAnalitica
public interface VisaoSinistrosRepository extends JpaRepository<VisaoSinistrosEntity, String>,
        JpaSpecificationExecutor<VisaoSinistrosEntity> {
}
