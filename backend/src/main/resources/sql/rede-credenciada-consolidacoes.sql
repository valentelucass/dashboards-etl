WITH base AS (
    SELECT c.data_emissao, c.ordem, c.consolidacao, c.parceiro_id, c.situacao, c.filial_emissora,
           c.minuta, c.cobrado, c.calculado, c.frete_rodogarcia, p.nome_fantasia AS parceiro,
           CASE WHEN c.situacao = N'Bloqueada' THEN N'Bloqueada'
                WHEN c.calculado = 0 THEN N'Cálculo zerado' END AS conferencia,
           MIN(CASE WHEN /* acesso */ 1=1 THEN 1 ELSE 0 END)
               OVER (PARTITION BY c.consolidacao) AS permitida
    FROM dbo.dashboard_rede_credenciada_consolidacoes AS c
    JOIN acesso.rede_parceiros p ON p.cnpj = c.parceiro_id COLLATE Latin1_General_100_BIN2
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
           ROW_NUMBER() OVER (PARTITION BY s.conferencia, s.filial_emissora, s.minuta
                              ORDER BY s.tem_frete DESC, s.data_emissao DESC,
                                       s.consolidacao DESC, s.ordem) AS linha_frete
    FROM selecionadas AS s
)
