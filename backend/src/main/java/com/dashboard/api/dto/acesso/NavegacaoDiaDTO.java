package com.dashboard.api.dto.acesso;

import java.util.List;

public record NavegacaoDiaDTO(String dia, long total, List<Visita> visitas,
                             String agrupamento, long segundosTotal, String atualizadoEm) {
    public NavegacaoDiaDTO(String dia, long total, List<Visita> visitas) {
        this(dia, total, visitas, "PAGINA", 0, null);
    }

    public record Visita(int ordem, String rota, String inicio, String fim, long segundos, long trechos) { }
}
