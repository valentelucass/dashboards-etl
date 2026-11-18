package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoMonitoramentoEntity;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@ConsultaAnalitica
public interface VisaoMonitoramentoRepository extends JpaRepository<VisaoMonitoramentoEntity, Long>,
        JpaSpecificationExecutor<VisaoMonitoramentoEntity> {

    List<VisaoMonitoramentoEntity> findByDataBetween(LocalDate inicio, LocalDate fim);
}
