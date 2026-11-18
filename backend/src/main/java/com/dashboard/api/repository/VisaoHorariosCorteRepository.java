package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoHorariosCorteEntity;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

@ConsultaAnalitica
public interface VisaoHorariosCorteRepository extends JpaRepository<VisaoHorariosCorteEntity, Long> {
    List<VisaoHorariosCorteEntity> findByDataBetween(LocalDate inicio, LocalDate fim);
}
