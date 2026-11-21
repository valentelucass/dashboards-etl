package com.dashboard.api.dto.redecredenciada;

import java.time.LocalDate;
import java.util.List;

public record RedeCredenciadaCustosDTO(
        LocalDate dataInicio, LocalDate dataFim, String referencia, String fonte,
        int diasCobertos, int diasSolicitados, Totais totais, List<Linha> linhas) {

    public record Linha(
            LocalDate dia, String status, String parceiro, long consolidacoes,
            long cobradoCentavos, long calculadoCentavos, long semCobrado, long semCalculado,
            long calculadoZero, long cobradoZero) {}

    public record Totais(
            long consolidacoes, long cobradoCentavos, long calculadoCentavos, long semCobrado,
            long semCalculado, long calculadoZero, long cobradoZero, long freteVinculadoCentavos,
            long fretesVinculados, long cobradoVinculadoCentavos, long consolidacoesSemFrete) {}
}
