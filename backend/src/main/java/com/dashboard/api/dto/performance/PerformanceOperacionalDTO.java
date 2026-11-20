package com.dashboard.api.dto.performance;

import java.time.LocalDate;

public final class PerformanceOperacionalDTO {

    private PerformanceOperacionalDTO() {
    }

    public record OcorrenciaAtraso(String ocorrencia, long notas) {}

    public record EntregaAtencao(long numeroMinuta, String cliente, String destino,
            LocalDate previsaoEntrega, String status, String alerta, String ultimaOcorrencia) {}

    public record EficienciaFilial(String filial, Double efe, Double eft, Double efd,
            Double otif, long semInformacao) {}
}
