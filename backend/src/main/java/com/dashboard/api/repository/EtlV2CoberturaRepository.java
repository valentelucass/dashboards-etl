package com.dashboard.api.repository;

import com.dashboard.api.dto.etl.EtlV2CoberturaDTO;
import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class EtlV2CoberturaRepository {

    private final JdbcOperations jdbc;

    public EtlV2CoberturaRepository(JdbcOperations jdbc) {
        this.jdbc = jdbc;
    }

    public List<EtlV2CoberturaDTO> consultar() {
        return jdbc.query("""
                SELECT entity_name, report_id, field_count, covered_days, latest_rows,
                       first_business_date, last_business_date,
                       CONVERT(varchar(40), latest_capture_utc, 127) AS latest_capture_iso,
                       coverage_status
                FROM dbo.vw_etl_v2_receiving_overview
                ORDER BY entity_name
                """, (rs, index) -> {
            String captura = rs.getString("latest_capture_iso");
            return new EtlV2CoberturaDTO(
                    rs.getString("entity_name"), rs.getInt("report_id"), rs.getInt("field_count"),
                    rs.getObject("covered_days", Long.class), rs.getObject("latest_rows", Long.class),
                    data(rs.getDate("first_business_date")), data(rs.getDate("last_business_date")),
                    captura == null ? null : OffsetDateTime.parse(captura), rs.getString("coverage_status")
            );
        });
    }

    private static LocalDate data(Date data) {
        return data == null ? null : data.toLocalDate();
    }
}
