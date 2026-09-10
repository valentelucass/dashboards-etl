package com.dashboard.api.dto.acesso;

import java.util.List;

public record NavegacaoDiaDTO(String dia, long total, List<Visita> visitas) {
    public record Visita(int ordem, String rota, String inicio, String fim, long segundos) { }
}
