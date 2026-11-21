WITH fretes AS (
    SELECT base.unique_id, base.cliente_cnpj, base.cnpj_parcela, base.documento_fatura, base.data_base_prazo,
           base.valor_faturado_rateado, base.valor_a_faturar, base.peso_acumulado, base.peso_atual, base.peso_total
    %s AND base.cliente_cnpj IN (:documentos)
), por_frete AS (
    SELECT f.unique_id, f.documento_fatura, f.data_base_prazo, f.valor_faturado_rateado, f.valor_a_faturar,
           COUNT_BIG(p.parcela_id) AS parcelas,
           SUM(CASE WHEN p.liquidacao <= :corte THEN rateio.valor ELSE 0 END) AS pago,
           SUM(CASE WHEN (p.liquidacao IS NULL OR p.liquidacao > :corte)
                         AND p.vencimento >= :corte THEN rateio.valor ELSE 0 END) AS a_vencer,
           SUM(CASE WHEN (p.liquidacao IS NULL OR p.liquidacao > :corte)
                         AND p.vencimento < :corte THEN rateio.valor ELSE 0 END) AS em_atraso,
           SUM(CASE WHEN (p.liquidacao IS NULL OR p.liquidacao > :corte)
                         AND p.vencimento IS NULL THEN rateio.valor ELSE 0 END) AS sem_vencimento
    FROM fretes f
    LEFT JOIN dbo.dashboard_parcelas_recebiveis p ON p.documento = f.documento_fatura
         AND p.emissao = f.data_base_prazo AND p.emissao <= :corte
         AND p.cliente_cnpj = f.cliente_cnpj AND p.cliente_cnpj = f.cnpj_parcela
    CROSS APPLY (VALUES (CONVERT(decimal(19,2),
        ROUND(p.valor * f.peso_acumulado / NULLIF(f.peso_total, 0), 2)
        - ROUND(p.valor * (f.peso_acumulado - f.peso_atual) / NULLIF(f.peso_total, 0), 2)))) rateio(valor)
    GROUP BY f.unique_id, f.documento_fatura, f.data_base_prazo, f.valor_faturado_rateado, f.valor_a_faturar
)
SELECT COALESCE(SUM(valor_faturado_rateado), 0) AS faturado, COALESCE(SUM(valor_a_faturar), 0) AS pendente,
       COALESCE(SUM(a_vencer), 0) AS a_vencer, COALESCE(SUM(em_atraso), 0) AS em_atraso,
       COALESCE(SUM(pago), 0) AS pago, COALESCE(SUM(sem_vencimento), 0) AS sem_vencimento,
       COUNT_BIG(*) AS fretes, COUNT_BIG(documento_fatura) AS fretes_faturados,
       COUNT_BIG(CASE WHEN documento_fatura IS NULL THEN 1 END) AS fretes_pendentes,
       COUNT_BIG(CASE WHEN documento_fatura IS NOT NULL AND parcelas = 0
                           AND (data_base_prazo IS NULL OR data_base_prazo <= :corte) THEN 1 END) AS fretes_sem_parcela
FROM por_frete
OPTION (MAXDOP 1);
