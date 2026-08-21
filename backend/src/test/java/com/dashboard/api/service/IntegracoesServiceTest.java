package com.dashboard.api.service;

import com.dashboard.api.client.IntegracaoSateliteClient;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntegracoesServiceTest {
    @Mock private IntegracaoSateliteClient client;

    @Test
    void delegaAgregadosDiretamenteAoSateliteSemConsultaESL() {
        IntegracoesService service = new IntegracoesService(client);
        var params = new LinkedMultiValueMap<String, String>();
        service.consultarIntegracoes(params, "PENDENCIAS", "2026-08-01", "2026-08-02");
        verify(client).buscarIntegracoesClientes(params, "PENDENCIAS", "2026-08-01", "2026-08-02");
    }

    @Test
    void converteIndisponibilidadeDoSateliteEm503() {
        when(client.buscarEvolucaoDiaria(anyString(), anyString(), anyString(), any())).thenThrow(new ResourceAccessException("offline"));
        IntegracoesService service = new IntegracoesService(client);
        assertThatThrownBy(() -> service.consultarEvolucaoDiaria("2026-08-01", "2026-08-02", "PENDENCIAS", List.of("SELIA")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void delegaHistoricoSftpComFiltrosSemConsultarOutraOrigem() {
        IntegracoesService service = new IntegracoesService(client);
        service.consultarExecucoesSftpClientes(1, 25, "VEDACIT", "CONCLUIDO", "2026-08-01", "2026-08-02");
        verify(client).buscarExecucoesSftpClientes(1, 25, "VEDACIT", "CONCLUIDO", "2026-08-01", "2026-08-02");
    }
}
