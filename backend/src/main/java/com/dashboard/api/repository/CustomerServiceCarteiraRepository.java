package com.dashboard.api.repository;

import com.dashboard.api.dto.customerservice.CustomerServiceCarteiraDTO;
import java.sql.Date;
import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CustomerServiceCarteiraRepository {
    public record Revisao(long versao, LocalDate competencia, String hash) {}
    public record Mudancas(int grupos, int cnpjs, int adicionados, int removidos, int transferidos) {
        public boolean mesmaComposicao() {
            return adicionados == 0 && removidos == 0 && transferidos == 0;
        }
    }

    private static final String ENTRADA = """
            ;WITH entrada AS (
                SELECT CAST(j.[key] AS varchar(14)) COLLATE Latin1_General_100_BIN2 documento,
                       CAST(j.[value] AS nvarchar(200)) COLLATE Latin1_General_100_BIN2 grupo
                FROM OPENJSON(CAST(? AS nvarchar(max))) j
            ), contas AS (
                SELECT id, UPPER(LTRIM(RTRIM(nome))) COLLATE Latin1_General_100_BIN2 grupo, ativa
                FROM acesso.customer_service_contas
            )
            """;
    private final JdbcTemplate jdbc;

    public CustomerServiceCarteiraRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Revisao bloquearRevisao() {
        // A linha existe desde a migration. O bloqueio pertence à transação inteira, inclusive com RCSI.
        return jdbc.queryForObject("""
                SELECT versao, competencia, hash_carteira
                FROM acesso.customer_service_carteira_revisao WITH (UPDLOCK, HOLDLOCK) WHERE id = 1
                """, (rs, i) -> new Revisao(rs.getLong(1), rs.getObject(2, LocalDate.class), rs.getString(3)));
    }

    public Mudancas comparar(String json) {
        return jdbc.queryForObject(ENTRADA + """
                , atuais AS (
                    SELECT d.documento, c.grupo
                    FROM acesso.customer_service_documentos d JOIN contas c ON c.id = d.conta_id
                    WHERE d.ativo = 1 AND c.ativa = 1
                )
                SELECT COUNT(DISTINCT e.grupo) grupos, COUNT(e.documento) cnpjs,
                    COUNT(CASE WHEN a.documento IS NULL THEN 1 END) adicionados,
                    COUNT(CASE WHEN e.documento IS NULL THEN 1 END) removidos,
                    COUNT(CASE WHEN e.grupo <> a.grupo THEN 1 END) transferidos,
                    (SELECT COUNT(*) FROM (
                        SELECT c.grupo FROM contas c WHERE EXISTS (SELECT 1 FROM entrada x WHERE x.grupo = c.grupo)
                        GROUP BY c.grupo HAVING COUNT(*) > 1
                    ) ambiguos) ambiguos
                FROM entrada e FULL OUTER JOIN atuais a ON a.documento = e.documento
                """, (rs, i) -> {
            if (rs.getInt("ambiguos") > 0) {
                throw new IllegalStateException("Há contas cadastradas com o mesmo nome. Revise as contas antes de importar.");
            }
            return new Mudancas(rs.getInt("grupos"), rs.getInt("cnpjs"), rs.getInt("adicionados"),
                    rs.getInt("removidos"), rs.getInt("transferidos"));
        }, json);
    }

    public void substituir(String json) {
        jdbc.update(ENTRADA + """
                INSERT INTO acesso.customer_service_contas(nome, ativa)
                SELECT DISTINCT e.grupo, 1 FROM entrada e
                WHERE NOT EXISTS (SELECT 1 FROM contas c WHERE c.grupo = e.grupo)
                """, json);
        jdbc.update(ENTRADA + """
                UPDATE c SET ativa = 1 FROM contas c
                WHERE ativa = 0 AND EXISTS (SELECT 1 FROM entrada e WHERE e.grupo = c.grupo)
                """, json);
        jdbc.update(ENTRADA + """
                UPDATE c SET ativa = 0 FROM contas c
                WHERE ativa = 1 AND NOT EXISTS (SELECT 1 FROM entrada e WHERE e.grupo = c.grupo)
                """, json);
        jdbc.update(ENTRADA + """
                UPDATE d SET ativo = 0 FROM acesso.customer_service_documentos d
                WHERE d.ativo = 1 AND NOT EXISTS (SELECT 1 FROM entrada e WHERE e.documento = d.documento)
                """, json);
        jdbc.update(ENTRADA + """
                UPDATE d SET conta_id = c.id, ativo = 1 FROM acesso.customer_service_documentos d
                JOIN entrada e ON e.documento = d.documento JOIN contas c ON c.grupo = e.grupo
                WHERE d.ativo = 0 OR d.conta_id <> c.id
                """, json);
        jdbc.update(ENTRADA + """
                INSERT INTO acesso.customer_service_documentos(conta_id, documento, ativo)
                SELECT c.id, e.documento, 1 FROM entrada e JOIN contas c ON c.grupo = e.grupo
                WHERE NOT EXISTS (SELECT 1 FROM acesso.customer_service_documentos d WHERE d.documento = e.documento)
                """, json);
    }

    public void registrar(CustomerServiceCarteiraDTO resumo, LocalDate competencia, String responsavel) {
        var mes = Date.valueOf(competencia);
        int alteradas = jdbc.update("""
                UPDATE acesso.customer_service_carteira_revisao SET versao = ?, competencia = ?, hash_carteira = ?
                WHERE id = 1 AND versao = ?
                """, resumo.versaoAtual(), mes, resumo.hashCarteira(), resumo.versaoAtual() - 1);
        if (alteradas != 1) throw new IllegalStateException("A carteira mudou. Confira uma nova prévia.");
        jdbc.update("""
                INSERT INTO acesso.customer_service_carteira_importacoes
                    (versao, competencia, hash_carteira, importado_por, grupos, cnpjs, adicionados, removidos, transferidos)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, resumo.versaoAtual(), mes, resumo.hashCarteira(), responsavel, resumo.grupos(), resumo.cnpjs(),
                resumo.adicionados(), resumo.removidos(), resumo.transferidos());
    }
}
