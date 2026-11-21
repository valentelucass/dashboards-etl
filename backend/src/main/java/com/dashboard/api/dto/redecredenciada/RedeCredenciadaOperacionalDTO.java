package com.dashboard.api.dto.redecredenciada;

import com.dashboard.api.dto.CoberturaArquivamentosDTO;
import java.time.LocalDate;
import java.util.List;

public record RedeCredenciadaOperacionalDTO(LocalDate dataInicio, LocalDate dataFim,
        CoberturaArquivamentosDTO coberturaArquivos, List<Entrega> entregas, List<Coleta> coletas) {

    public record Entrega(LocalDate data, String parceiro, long finalizadas, long anexadas, Long arquivadas) {}

    public record Coleta(LocalDate data, String parceiro, long finalizadas, long noPrazo) {}
}
