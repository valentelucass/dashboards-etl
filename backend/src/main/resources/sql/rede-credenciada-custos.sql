WITH base AS (
    SELECT c.*,
           MIN(CASE WHEN /* acesso */ 1=1 THEN 1 ELSE 0 END)
               OVER (PARTITION BY c.consolidacao) AS permitida
    FROM dbo.dashboard_rede_credenciada_consolidacoes AS c
    WHERE c.data_emissao BETWEEN :dataInicio AND :dataFim
      AND c.consolidacao IS NOT NULL
), selecionadas AS (
    SELECT b.*,
           CASE WHEN b.minuta IS NOT NULL AND b.filial_emissora IS NOT NULL
                      AND b.frete_rodogarcia IS NOT NULL THEN 1 ELSE 0 END AS tem_frete
    FROM base AS b
    WHERE b.permitida = 1 /* filtros */
), numeradas AS (
    SELECT s.*,
           ROW_NUMBER() OVER (PARTITION BY s.consolidacao
                              ORDER BY s.data_emissao DESC, s.ordem) AS linha_consolidacao,
           MAX(s.tem_frete) OVER (PARTITION BY s.consolidacao) AS tem_vinculo,
           ROW_NUMBER() OVER (PARTITION BY s.filial_emissora, s.minuta
                              ORDER BY s.tem_frete DESC, s.data_emissao DESC,
                                       s.consolidacao DESC, s.ordem) AS linha_frete
    FROM selecionadas AS s
)
SELECT GROUPING(data_emissao) AS total, data_emissao, situacao, parceiro,
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
GROUP BY GROUPING SETS ((data_emissao, situacao, parceiro), ())
ORDER BY data_emissao, situacao, parceiro;
