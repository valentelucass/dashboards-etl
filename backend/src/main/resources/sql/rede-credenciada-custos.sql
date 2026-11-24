SELECT GROUPING(data_emissao) AS total, data_emissao, situacao, parceiro, conferencia,
       COUNT_BIG(CASE WHEN linha_consolidacao = 1 THEN 1 END) AS consolidacoes,
       COALESCE(SUM(CASE WHEN linha_consolidacao = 1 THEN cobrado END), 0) * 100 AS cobrado_centavos,
       COALESCE(SUM(CASE WHEN linha_consolidacao = 1 THEN calculado END), 0) * 100 AS calculado_centavos,
       COUNT_BIG(CASE WHEN linha_consolidacao = 1 AND cobrado IS NULL THEN 1 END) AS sem_cobrado,
       COUNT_BIG(CASE WHEN linha_consolidacao = 1 AND calculado IS NULL THEN 1 END) AS sem_calculado,
       COUNT_BIG(CASE WHEN linha_consolidacao = 1 AND calculado = 0 THEN 1 END) AS calculado_zero,
       COUNT_BIG(CASE WHEN linha_consolidacao = 1 AND cobrado = 0 THEN 1 END) AS cobrado_zero,
       COALESCE(SUM(CASE WHEN tem_frete = 1 AND linha_frete = 1 THEN frete_rodogarcia END), 0) * 100 AS frete_centavos,
       COUNT_BIG(CASE WHEN tem_frete = 1 AND linha_frete = 1 THEN 1 END) AS fretes,
       COALESCE(SUM(CASE WHEN linha_consolidacao = 1 AND tem_vinculo = 1 THEN cobrado END), 0) * 100 AS cobrado_vinculado_centavos,
       COUNT_BIG(CASE WHEN linha_consolidacao = 1 AND tem_vinculo = 0 THEN 1 END) AS sem_frete
FROM numeradas
GROUP BY GROUPING SETS ((data_emissao, situacao, parceiro, conferencia), (conferencia))
ORDER BY data_emissao, situacao, parceiro;
