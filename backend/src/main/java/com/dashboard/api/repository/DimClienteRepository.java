package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.DimClienteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

@ConsultaAnalitica
public interface DimClienteRepository extends JpaRepository<DimClienteEntity, String> {
}
