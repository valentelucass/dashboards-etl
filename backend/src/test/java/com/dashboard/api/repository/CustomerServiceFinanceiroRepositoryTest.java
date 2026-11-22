package com.dashboard.api.repository;

import com.dashboard.api.builder.DashboardExportSqlBuilder;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceFinanceiroDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CustomerServiceFinanceiroRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final EscopoFilialService escopo = mock(EscopoFilialService.class);
    private final LocalDate fim = LocalDate.of(2026, 11, 21);
    private final FiltroConsultaDTO periodo = new FiltroConsultaDTO(fim.withDayOfMonth(1), fim, Map.of());
    private final CustomerServiceFinanceiroRepository repository;

    CustomerServiceFinanceiroRepositoryTest() throws IOException {
        repository = new CustomerServiceFinanceiroRepository(
                jdbc, new DashboardExportSqlBuilder(PeriodoOffsetDateTimeHelper.padrao()), escopo);
    }

    @Test void contaSemDocumentosNuncaConsultaTodosOsClientes() {
        assertThatThrownBy(() -> repository.consultar(periodo, List.of(), fim))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(jdbc, escopo);
    }

    @Test void limitaOCalculoAoDocumentoExatoEFilialDoUsuario() {
        when(escopo.escopoAtual()).thenReturn(new EscopoFilialService.EscopoFilial(false, List.of("REC")));
        List<String> documentos = List.of("00000000000001", "00000000000002");
        repository.consultar(periodo, documentos, fim);
        var sql = ArgumentCaptor.forClass(String.class);
        var params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc).queryForObject(sql.capture(), params.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<CustomerServiceFinanceiroDTO>>any());
        assertThat(sql.getValue()).contains("(:escopoFiliais)", "base.cliente_cnpj IN (" + CustomerServiceDocumentos.SELECAO + ")",
                "p.cliente_cnpj = f.cliente_cnpj", "p.liquidacao <= :corte");
        assertThat(params.getValue().getValue("documentos")).isEqualTo("[\"00000000000001\",\"00000000000002\"]");
        assertThat(params.getValue().getValue("escopoFiliais")).isEqualTo(List.of("rec"));
        assertThat(params.getValue().getValue("corte")).isEqualTo(fim);
    }
}
