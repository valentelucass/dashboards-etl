package com.dashboard.api.filter;

import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.FilialKeyUtils;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

public final class DashboardQueryFilters {

    private static final String SENTINELA_SEM_FILTRO = "__sem_filtro__";

    private DashboardQueryFilters() {
    }

    public static ParametroLista of(Collection<String> valores) {
        List<String> normalizados = normalizar(valores);
        return normalizados.isEmpty()
                ? new ParametroLista(List.of(SENTINELA_SEM_FILTRO), 1)
                : new ParametroLista(normalizados, 0);
    }

    public static ParametroLista filiais(Collection<String> valores) {
        List<String> normalizados = FilialKeyUtils.normalizarCodigosParaFiltro(valores);
        if (!normalizados.isEmpty()) {
            return new ParametroLista(normalizados, 0);
        }
        int vazio = FilialKeyUtils.possuiTexto(valores) ? 0 : 1;
        return new ParametroLista(List.of(SENTINELA_SEM_FILTRO), vazio);
    }

    public static ParametroLista escopo(EscopoFilialService.EscopoFilial escopo) {
        return escopo.acessoTotal() ? of(List.of()) : new ParametroLista(of(escopo.filiaisOrdenadas()).valores(), 0);
    }

    public static ParametroLista escopoFiliais(EscopoFilialService.EscopoFilial escopo) {
        return escopo.acessoTotal() ? filiais(List.of()) : filiais(escopo.filiaisOrdenadas());
    }

    private static List<String> normalizar(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    public record ParametroLista(List<String> valores, int vazio) {
    }
}
