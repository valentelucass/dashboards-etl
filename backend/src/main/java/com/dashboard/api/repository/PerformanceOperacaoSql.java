package com.dashboard.api.repository;

final class PerformanceOperacaoSql {
    private PerformanceOperacaoSql() {}

    private static final String ENTREGA = """
            (o.codigo = 1 OR o.descricao COLLATE Latin1_General_100_CI_AI = N'Entrega Realizada com Ressalvas')
            """;
    private static final String MARCO = "(o.codigo IN (110, 103, 102, 101, 55) OR " + ENTREGA + ")";
    static final String PERIODO_OCORRENCIA = """
            ([Data de Finalização] >= :dataInicio AND [Data de Finalização] < :dataFim)
            OR EXISTS (
                SELECT 1 FROM dbo.dashboard_performance_ocorrencias o
                 WHERE o.minuta = base_raw.[Nº Minuta] AND o.ocorrido_em >= :dataInicio
                   AND o.ocorrido_em < :dataFim AND %s)
            """.formatted(MARCO);

    static String ocorrenciasAtraso(String filtros) {
        return """
                , atrasadas AS (
                    SELECT numero_minuta, notas_fiscais FROM entregas
                     WHERE status_norm NOT IN (N'Finalizada', N'Cancelada')
                       AND data_previsao_entrega < :hoje %s
                ), historico AS (
                    SELECT o.minuta, n.nota, o.descricao,
                           MAX(CASE WHEN %s THEN 1 ELSE 0 END) OVER (PARTITION BY o.minuta, n.nota) AS entregue,
                           ROW_NUMBER() OVER (PARTITION BY o.minuta, n.nota
                               ORDER BY o.ocorrido_em DESC, o.data_particao DESC, o.escopo, o.ordem DESC) AS linha
                    FROM atrasadas a JOIN dbo.dashboard_performance_ocorrencias o ON o.minuta = a.numero_minuta
                    CROSS APPLY (VALUES(NULLIF(TRIM(o.nota_fiscal), N''))) n(nota)
                    WHERE n.nota IS NOT NULL
                ), cobranca AS (
                    SELECT h.minuta, h.nota, h.descricao, h.entregue FROM historico h WHERE h.linha = 1
                    UNION ALL
                    SELECT DISTINCT a.numero_minuta, TRIM(n.value), NULL, 0
                    FROM atrasadas a CROSS APPLY STRING_SPLIT(a.notas_fiscais, N',') n
                    WHERE TRIM(n.value) <> N'' AND NOT EXISTS (
                        SELECT 1 FROM historico h WHERE h.minuta = a.numero_minuta AND h.nota = TRIM(n.value))
                )
                SELECT COALESCE(NULLIF(TRIM(descricao), N''), N'Sem ocorrência') AS ocorrencia, COUNT_BIG(1) AS notas
                FROM cobranca WHERE entregue = 0
                GROUP BY COALESCE(NULLIF(TRIM(descricao), N''), N'Sem ocorrência') ORDER BY notas DESC, ocorrencia
                """.formatted(filtros, ENTREGA);
    }

    static String entregasAtencao(String filtros) {
        return """
                , atencao AS (
                    SELECT numero_minuta, pagador, cidade_destino, uf_destino, data_previsao_entrega, status_norm,
                           CASE WHEN data_previsao_entrega < :hoje THEN 1
                                WHEN data_previsao_entrega = :hoje THEN 2 ELSE 3 END AS prioridade
                      FROM entregas
                     WHERE status_norm NOT IN (N'Finalizada', N'Cancelada')
                       AND (data_previsao_entrega <= :hoje OR status_norm = N'Em Tratativa') %s
                ), pagina AS (
                    SELECT * FROM atencao ORDER BY prioridade, data_previsao_entrega, numero_minuta
                    OFFSET :offset ROWS FETCH NEXT :limite ROWS ONLY
                )
                SELECT t.total, p.numero_minuta, p.pagador,
                       CONCAT_WS(N'/', NULLIF(p.cidade_destino,N'SEM_CIDADE'), NULLIF(TRIM(p.uf_destino),N'')) AS destino,
                       p.data_previsao_entrega, p.status_norm,
                       CASE p.prioridade WHEN 1 THEN N'Vencida' WHEN 2 THEN N'Vence hoje' ELSE N'Em tratativa' END AS alerta,
                       ult.descricao AS ultima_ocorrencia
                FROM (SELECT COUNT_BIG(1) AS total FROM atencao) t
                LEFT JOIN pagina p ON 1 = 1
                OUTER APPLY (SELECT TOP (1) o.descricao FROM dbo.dashboard_performance_ocorrencias o
                             WHERE o.minuta = p.numero_minuta
                             ORDER BY o.ocorrido_em DESC, o.data_particao DESC, o.escopo, o.ordem DESC) ult
                ORDER BY p.prioridade, p.data_previsao_entrega, p.numero_minuta
                """.formatted(filtros);
    }

    static String eficiencia(String filtros) {
        return """
                , elegiveis AS (
                    SELECT numero_minuta, data_finalizacao, is_finalizada, is_no_prazo
                    FROM entregas WHERE status_norm <> N'Cancelada' %s
                )
                SELECT e.numero_minuta, e.data_finalizacao, e.is_finalizada, e.is_no_prazo,
                       o.codigo, NULLIF(TRIM(o.nota_fiscal), N'') AS nota_fiscal, o.ocorrido_em,
                       NULLIF(TRIM(o.filial), N'') AS filial, CASE WHEN %s THEN 1 ELSE 0 END AS entrega
                FROM elegiveis e
                LEFT JOIN dbo.dashboard_performance_ocorrencias o ON o.minuta = e.numero_minuta AND %s
                ORDER BY e.numero_minuta, o.ocorrido_em,
                         CASE o.codigo WHEN 110 THEN 0 WHEN 102 THEN 1 WHEN 103 THEN 2
                                       WHEN 101 THEN 3 WHEN 55 THEN 4 ELSE 5 END,
                         o.data_particao, o.escopo, o.ordem
                """.formatted(filtros, ENTREGA, MARCO);
    }
}
