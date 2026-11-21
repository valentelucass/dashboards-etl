package com.dashboard.api.controller;

import com.dashboard.api.repository.CustomerServiceOperacionalRepository;
import com.dashboard.api.service.CustomerServiceClientesService;
import com.dashboard.api.service.ValidadorPeriodoService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class CustomerServiceOperacionalControllerTest {
    @Test
    void rejeitaDatasInvalidasAntesDeConsultarQualquerContaOuIndicador() {
        var contas = mock(CustomerServiceClientesService.class);
        var operacao = mock(CustomerServiceOperacionalRepository.class);
        var controller = new CustomerServiceOperacionalController(contas, operacao, new ValidadorPeriodoService());
        var id = List.of(1L);
        var inicio = LocalDate.of(2026,11,1);
        assertThatThrownBy(() -> controller.consultar(id, null, inicio)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> controller.consultar(id, inicio, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> controller.consultar(id, inicio, inicio.minusDays(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> controller.consultar(id, inicio, inicio.plusDays(366))).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(contas, operacao);
    }
}
