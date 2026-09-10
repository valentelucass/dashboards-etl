package com.dashboard.api.util;

import java.util.Locale;
import java.util.Optional;

/** Leitura local conservadora: nunca abre conexão nem inclui a URL em erros/logs. */
public final class SqlServerJdbcUrl {
    private SqlServerJdbcUrl() { }

    public static Optional<String> nomeBancoExplicito(String url) {
        if (url == null || !url.startsWith("jdbc:sqlserver://")) return Optional.empty();
        int pos = url.indexOf(';');
        if (pos < 0) return Optional.empty();
        String banco = null;
        while (pos < url.length()) {
            while (pos < url.length() && (url.charAt(pos) == ';' || Character.isWhitespace(url.charAt(pos)))) pos++;
            if (pos == url.length()) break;
            int inicio = pos;
            while (pos < url.length() && url.charAt(pos) != '=' && url.charAt(pos) != ';') pos++;
            if (pos == url.length() || url.charAt(pos) != '=') return Optional.empty();
            String chave = url.substring(inicio, pos).trim().toLowerCase(Locale.ROOT);
            if (chave.isEmpty()) return Optional.empty();
            pos++;
            while (pos < url.length() && Character.isWhitespace(url.charAt(pos))) pos++;
            StringBuilder valor = new StringBuilder();
            if (pos < url.length() && url.charAt(pos) == '{') {
                pos++;
                boolean fechado = false;
                while (pos < url.length()) {
                    char c = url.charAt(pos++);
                    if (c == '}') {
                        if (pos < url.length() && url.charAt(pos) == '}') { valor.append('}'); pos++; }
                        else { fechado = true; break; }
                    } else valor.append(c);
                }
                if (!fechado) return Optional.empty();
                while (pos < url.length() && Character.isWhitespace(url.charAt(pos))) pos++;
                if (pos < url.length() && url.charAt(pos) != ';') return Optional.empty();
            } else {
                while (pos < url.length() && url.charAt(pos) != ';') {
                    char c = url.charAt(pos++);
                    if (c == '{' || c == '}') return Optional.empty();
                    valor.append(c);
                }
            }
            if (chave.equals("databasename") || chave.equals("database")) {
                // Rejeita aliases/definições duplicadas, sem depender da precedência do driver.
                if (banco != null || valor.toString().isBlank()) return Optional.empty();
                banco = valor.toString().trim();
            }
        }
        return Optional.ofNullable(banco);
    }
}
