package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.CoberturaArquivamentosDTO;
import java.sql.Date;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class ComprovantesArquivadosRepository {
    private final NamedParameterJdbcOperations jdbc;

    public ComprovantesArquivadosRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc) {
        this.jdbc = jdbc;
    }

    public CoberturaArquivamentosDTO coberturaArquivos(LocalDate inicio, LocalDate fim) {
        long solicitados = Math.max(0, ChronoUnit.DAYS.between(inicio, fim) + 1);
        var params = new MapSqlParameterSource("inicio", inicio).addValue("fim", fim);
        try {
            return jdbc.queryForObject("""
                    SELECT MIN(data_arquivo) primeira, MAX(data_arquivo) ultima,
                           COUNT(DISTINCT CASE WHEN data_arquivo BETWEEN :inicio AND :fim THEN data_arquivo END) dias
                    FROM dbo.rede_credenciada_cobertura WHERE entidade = 'COMPROVANTES_ENTREGA'
                    """, params, (rs, linha) -> {
                Date primeira = rs.getDate("primeira");
                Date ultima = rs.getDate("ultima");
                long dias = rs.getLong("dias");
                return new CoberturaArquivamentosDTO(primeira == null ? null : primeira.toLocalDate(),
                        ultima == null ? null : ultima.toLocalDate(), dias, solicitados, solicitados > 0 && dias == solicitados);
            });
        } catch (DataAccessException ex) {
            // A previous publication can still serve pickups and attached receipts.
            Throwable causa = ex.getMostSpecificCause();
            if (causa instanceof SQLException sql && (sql.getErrorCode() == 208 || sql.getErrorCode() == 5313)) {
                return new CoberturaArquivamentosDTO(null, null, 0, solicitados, false);
            }
            throw ex;
        }
    }
}
