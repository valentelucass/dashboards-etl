package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoLocalizacaoCargasEntity;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@ConsultaAnalitica
public interface VisaoLocalizacaoCargasRepository extends JpaRepository<VisaoLocalizacaoCargasEntity, Long>,
        JpaSpecificationExecutor<VisaoLocalizacaoCargasEntity> {

    List<VisaoLocalizacaoCargasEntity> findByDataFreteGreaterThanEqualAndDataFreteLessThan(
            OffsetDateTime inicioInclusivo,
            OffsetDateTime fimExclusivo
    );
}
