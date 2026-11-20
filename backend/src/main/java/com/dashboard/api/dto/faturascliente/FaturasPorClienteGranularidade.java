package com.dashboard.api.dto.faturascliente;

import java.util.Locale;

public enum FaturasPorClienteGranularidade {
    DIA,
    SEMANA,
    MES,
    ANO;

    public static FaturasPorClienteGranularidade from(String valor) {
        try {
            return valueOf(valor.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException ex) {
            return MES;
        }
    }
}
