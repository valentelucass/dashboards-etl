package com.dashboard.api.repository;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.util.List;
import java.util.regex.Pattern;

final class CustomerServiceDocumentos {
    static final String TABELA = "OPENJSON(CAST(:documentos AS nvarchar(max))) WITH (documento nvarchar(18) '$')";
    static final String SELECAO = "SELECT documento FROM " + TABELA;
    private static final Pattern CNPJ = Pattern.compile("[A-Z0-9]{14}");

    private CustomerServiceDocumentos() {}

    static String json(List<String> documentos, boolean incluirMascaras) {
        if (documentos == null || documentos.isEmpty()) throw new IllegalArgumentException("Conta sem CNPJ.");
        var valores = JsonNodeFactory.instance.arrayNode();
        for (String documento : documentos) {
            if (documento == null || !CNPJ.matcher(documento).matches()) throw new IllegalArgumentException("CNPJ da conta inválido.");
            valores.add(documento);
            if (incluirMascaras) {
                valores.add(documento.substring(0,2) + "." + documento.substring(2,5) + "." + documento.substring(5,8)
                        + "/" + documento.substring(8,12) + "-" + documento.substring(12));
            }
        }
        return valores.toString();
    }
}
