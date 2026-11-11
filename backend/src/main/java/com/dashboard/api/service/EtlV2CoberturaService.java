package com.dashboard.api.service;

import com.dashboard.api.dto.etl.EtlV2CoberturaDTO;
import com.dashboard.api.repository.EtlV2CoberturaRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EtlV2CoberturaService {

    private static final Logger LOG = LoggerFactory.getLogger(EtlV2CoberturaService.class);
    private final EtlV2CoberturaRepository repository;

    public EtlV2CoberturaService(EtlV2CoberturaRepository repository) {
        this.repository = repository;
    }

    public List<EtlV2CoberturaDTO> consultar() {
        try {
            return repository.consultar();
        } catch (DataAccessException ex) {
            LOG.warn("Cobertura do ETL V2 indisponível: {}", ex.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "A cobertura da base nova está indisponível no momento.");
        }
    }
}
