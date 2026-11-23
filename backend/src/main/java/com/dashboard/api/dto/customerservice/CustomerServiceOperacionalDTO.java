package com.dashboard.api.dto.customerservice;

import com.dashboard.api.dto.CoberturaArquivamentosDTO;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CustomerServiceOperacionalDTO(long totalEntregas, long finalizadas, long noPrazo,
        long coletasFinalizadas, long coletasNoPrazo, long anexadas, Long arquivadas,
        BigDecimal pesoRealKg, BigDecimal valorNf, BigDecimal valorFrete,
        List<Status> porStatus, List<Dia> evolucao, Long avarias, Long extravios,
        Long fretesComAvariaOuExtravio, List<Ocorrencia> ocorrenciasPorTipo,
        CoberturaOcorrencias coberturaOcorrencias, CoberturaArquivamentosDTO coberturaArquivos) {
    public record CoberturaOcorrencias(long diasCobertos, long diasSolicitados, LocalDate ultimaData) {}
    public record Status(String status, long quantidade) {}
    public record Dia(LocalDate dia, long totalEntregas, long finalizadas, long noPrazo) {}
    public record Ocorrencia(String tipo, long quantidade) {}
    public record Coletas(long finalizadas, long noPrazo) {}
}
