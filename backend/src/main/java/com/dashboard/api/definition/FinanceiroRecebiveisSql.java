package com.dashboard.api.definition;

final class FinanceiroRecebiveisSql {
    private FinanceiroRecebiveisSql() {
    }

    // O nominal e a baixa pertencem ao título. O rateio é calculado antes dos filtros/ACL
    // para que um frete nunca receba a parte de outra filial. A diferença dos acumulados
    // arredondados preserva até o último centavo nos recortes de uma mesma fatura.
    static final String FONTE = """
            (
                SELECT f.*, TRY_CONVERT(datetimeoffset, JSON_VALUE(CASE WHEN ISJSON(origem.[Metadata]) = 1 THEN origem.[Metadata] END, '$.service_at')) AS data_servico_frete,
                       f.data_emissao_cte_date AS data_financeira, titulo.baixa_titulo,
                       CONVERT(decimal(19,2),
                           ROUND(titulo.nominal * peso.acumulado / peso.total, 2)
                           - ROUND(titulo.nominal * (peso.acumulado - peso.atual) / peso.total, 2)
                       ) AS valor_faturado_rateado,
                       CONVERT(decimal(19,2), 0) AS valor_a_faturar
                FROM dbo.fato_gestao_vista_faturas f
                LEFT JOIN dbo.vw_faturas_por_cliente_powerbi origem ON origem.[ID Único] = f.unique_id
                JOIN (
                    SELECT unique_id,
                           MAX(data_baixa_fatura) OVER (PARTITION BY cliente_chave, documento_fatura) AS baixa_titulo,
                           COALESCE(MAX(COALESCE(valor_fit_ant, valor_fatura))
                               OVER (PARTITION BY cliente_chave, documento_fatura),
                               SUM(COALESCE(valor_frete, 0)) OVER (PARTITION BY cliente_chave, documento_fatura)) AS nominal,
                           SUM(COALESCE(valor_frete, 0)) OVER (PARTITION BY cliente_chave, documento_fatura) AS soma,
                           SUM(COALESCE(valor_frete, 0)) OVER (PARTITION BY cliente_chave, documento_fatura
                               ORDER BY unique_id ROWS UNBOUNDED PRECEDING) AS acumulado,
                           COUNT_BIG(*) OVER (PARTITION BY cliente_chave, documento_fatura) AS quantidade,
                           ROW_NUMBER() OVER (PARTITION BY cliente_chave, documento_fatura ORDER BY unique_id) AS posicao
                    FROM dbo.fato_gestao_vista_faturas
                    WHERE excluido_na_origem = 0 AND documento_fatura IS NOT NULL
                ) titulo ON titulo.unique_id = f.unique_id
                CROSS APPLY (VALUES (
                    CONVERT(decimal(19,4), CASE WHEN titulo.soma = 0 THEN titulo.posicao ELSE titulo.acumulado END),
                    CONVERT(decimal(19,4), CASE WHEN titulo.soma = 0 THEN 1 ELSE COALESCE(f.valor_frete,0) END),
                    CONVERT(decimal(19,4), CASE WHEN titulo.soma = 0 THEN titulo.quantidade ELSE titulo.soma END)
                )) peso(acumulado, atual, total)
                WHERE f.excluido_na_origem = 0 AND f.documento_fatura IS NOT NULL
                UNION ALL
                SELECT f.*, registro.servico, COALESCE(f.data_emissao_cte_date, CONVERT(date, registro.servico)), CONVERT(date,NULL), CONVERT(decimal(19,2),0),
                       CONVERT(decimal(19,2),COALESCE(f.valor_frete,0))
                FROM dbo.fato_gestao_vista_faturas f
                JOIN dbo.vw_faturas_por_cliente_powerbi origem ON origem.[ID Único] = f.unique_id
                CROSS APPLY OPENJSON(CASE WHEN ISJSON(origem.[Metadata]) = 1 THEN origem.[Metadata] END)
                    WITH (id bigint '$.id', servico datetimeoffset '$.service_at', cortesia bit '$.courtesy',
                          status_frete nvarchar(64) '$.status') registro
                LEFT JOIN dbo.fato_fretes_faturamento frete ON frete.frete_id = registro.id
                WHERE f.excluido_na_origem = 0 AND f.documento_fatura IS NULL
                  AND (frete.excluido_na_origem = 0 AND frete.is_elegivel_faturamento = 1
                    OR (frete.frete_id IS NULL AND registro.id IS NOT NULL AND registro.servico IS NOT NULL
                        AND registro.cortesia = 0
                        AND NOT (COALESCE(f.classificacao,N'') COLLATE Latin1_General_CI_AI LIKE N'%bloqueio%'
                            AND (f.classificacao COLLATE Latin1_General_CI_AI LIKE N'%anulacao%'
                                 OR f.classificacao COLLATE Latin1_General_CI_AI LIKE N'%isolamento%'))
                        AND COALESCE(f.status_cte,N'') COLLATE Latin1_General_CI_AI NOT LIKE N'%cancel%'
                        AND COALESCE(f.status_cte_result,N'') COLLATE Latin1_General_CI_AI NOT LIKE N'%cancel%'
                        AND COALESCE(registro.status_frete,N'') COLLATE Latin1_General_CI_AI NOT LIKE N'cancel%'))
            )
            """;
}
