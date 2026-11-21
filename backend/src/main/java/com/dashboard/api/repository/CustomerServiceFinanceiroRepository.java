package com.dashboard.api.repository;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.definition.DashboardExportDefinition;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceFinanceiroDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class CustomerServiceFinanceiroRepository {
    private final NamedParameterJdbcOperations jdbc;
    private final DashboardExportSqlBuilder sqlBuilder;
    private final EscopoFilialService escopo;
    private final String consulta;

    public CustomerServiceFinanceiroRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc,
            DashboardExportSqlBuilder sqlBuilder, EscopoFilialService escopo) throws IOException {
        this.jdbc = jdbc;
        this.sqlBuilder = sqlBuilder;
        this.escopo = escopo;
        this.consulta = new ClassPathResource("sql/customer-service-financeiro.sql")
                .getContentAsString(StandardCharsets.UTF_8);
    }

    public CustomerServiceFinanceiroDTO consultar(FiltroConsultaDTO periodo, List<String> documentos, LocalDate corte) {
        if (documentos == null || documentos.isEmpty()) {
            throw new IllegalArgumentException("A conta precisa ter ao menos um CNPJ autorizado.");
        }
        var fonte = sqlBuilder.buildFilteredSource(DashboardExportDefinition.FATURAS_POR_CLIENTE,
                periodo, escopo.escopoAtual(), Set.of());
        var parametros = fonte.params().addValue("documentos", documentos).addValue("corte", corte);
        return jdbc.queryForObject(consulta.formatted(fonte.sql()), parametros, (rs, linha) ->
                new CustomerServiceFinanceiroDTO(rs.getBigDecimal("faturado"), rs.getBigDecimal("pendente"),
                        rs.getBigDecimal("a_vencer"), rs.getBigDecimal("em_atraso"), rs.getBigDecimal("pago"),
                        rs.getBigDecimal("sem_vencimento"), rs.getLong("fretes"), rs.getLong("fretes_faturados"),
                        rs.getLong("fretes_pendentes"), rs.getLong("fretes_sem_parcela"), corte));
    }
}
