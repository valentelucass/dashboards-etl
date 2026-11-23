CREATE SYNONYM dbo.rede_agentes_coleta FOR ETL_SISTEMA_V2.pub.rede_agentes_coleta;
GO
CREATE TABLE acesso.rede_parceiros (
    cnpj varchar(14) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
    nome_fantasia nvarchar(250) NOT NULL,
    razao_social nvarchar(250) NOT NULL,
    ativo bit NOT NULL,
    CONSTRAINT CK_rede_parceiros_cnpj CHECK (DATALENGTH(cnpj) = 14 AND cnpj NOT LIKE '%[^0-9A-Z]%')
);

CREATE TABLE acesso.rede_parceiro_nomes (
    nome nvarchar(250) COLLATE Latin1_General_100_CI_AI NOT NULL,
    cnpj varchar(14) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES acesso.rede_parceiros(cnpj),
    PRIMARY KEY (nome, cnpj)
);
GO
-- A mesma sigla pode pertencer a várias transportadoras. Só um nome completo inequívoco identifica a empresa.
CREATE VIEW acesso.rede_nomes_unicos AS
SELECT nome, MIN(cnpj) AS cnpj
FROM acesso.rede_parceiro_nomes
GROUP BY nome
HAVING COUNT(*) = 1;
GO
CREATE VIEW acesso.rede_manifestos_parceiros AS
SELECT m.[Número] AS manifesto, p.cnpj
FROM dbo.vw_fato_manifestos_dash m
CROSS APPLY (VALUES (NULLIF(REPLACE(REPLACE(REPLACE(TRIM(m.[Proprietário/Documento]),'.',''),'/',''),'-',''),''))) doc(cnpj)
LEFT JOIN acesso.rede_nomes_unicos dono ON doc.cnpj IS NULL
    AND dono.nome = m.[Proprietário/Nome] COLLATE Latin1_General_100_CI_AI
LEFT JOIN acesso.rede_nomes_unicos filial ON filial.nome = m.[Filial] COLLATE Latin1_General_100_CI_AI
JOIN acesso.rede_parceiros p ON p.cnpj = COALESCE(doc.cnpj COLLATE Latin1_General_100_BIN2, dono.cnpj, filial.cnpj)
WHERE filial.cnpj IS NULL OR p.cnpj = filial.cnpj;
GO
CREATE FUNCTION acesso.rede_executor_entrega(@minuta bigint, @manifesto bigint, @regiao nvarchar(255))
RETURNS TABLE AS RETURN
    SELECT p.nome_fantasia AS parceiro
    FROM (
        SELECT n.cnpj FROM acesso.rede_nomes_unicos n
        WHERE @manifesto IS NULL AND n.nome = @regiao COLLATE Latin1_General_100_CI_AI
        UNION ALL
        SELECT m.cnpj FROM acesso.rede_manifestos_parceiros m
        WHERE m.manifesto = @manifesto
    ) executor
    JOIN acesso.rede_parceiros p ON p.cnpj = executor.cnpj
    WHERE NOT EXISTS (SELECT 1 FROM dbo.dashboard_performance_ocorrencias retirada
                      WHERE retirada.minuta = @minuta AND retirada.codigo = 136);
GO
CREATE PROCEDURE acesso.atualizar_rede_parceiros @carteira nvarchar(max)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @lista TABLE (
        cnpj varchar(14) COLLATE Latin1_General_100_BIN2 PRIMARY KEY,
        razao nvarchar(250) NOT NULL, fantasia nvarchar(250) NOT NULL, ativo bit NOT NULL,
        aliases nvarchar(max)
    );
    INSERT @lista (cnpj, razao, fantasia, ativo, aliases)
    SELECT UPPER(REPLACE(REPLACE(REPLACE(TRIM(cnpj), '.', ''), '/', ''), '-', '')),
           NULLIF(TRIM(razao), ''), NULLIF(TRIM(fantasia), ''), ativo, aliases
    FROM OPENJSON(@carteira) WITH (cnpj nvarchar(32), razao nvarchar(250),
        fantasia nvarchar(250), ativo bit, aliases nvarchar(max) AS JSON);
    IF NOT EXISTS (SELECT 1 FROM @lista) THROW 50001, N'Carteira de parcerias vazia.', 1;

    BEGIN TRANSACTION;
    -- A lista é um retrato atual. Manter a empresa e seus nomes anteriores preserva os serviços históricos.
    UPDATE p WITH (TABLOCKX) SET ativo = COALESCE(l.ativo, 0),
        razao_social = COALESCE(l.razao, p.razao_social), nome_fantasia = COALESCE(l.fantasia, p.nome_fantasia)
    FROM acesso.rede_parceiros p LEFT JOIN @lista l ON l.cnpj = p.cnpj;
    INSERT acesso.rede_parceiros (cnpj, razao_social, nome_fantasia, ativo)
    SELECT cnpj, razao, fantasia, ativo FROM @lista l
    WHERE NOT EXISTS (SELECT 1 FROM acesso.rede_parceiros p WHERE p.cnpj = l.cnpj);
    INSERT acesso.rede_parceiro_nomes (nome, cnpj)
    SELECT nomes.nome, l.cnpj
    FROM @lista l CROSS APPLY (
        SELECT l.razao COLLATE Latin1_General_100_CI_AI AS nome
        UNION SELECT l.fantasia
        UNION SELECT TRIM(j.value) FROM OPENJSON(l.aliases) j WHERE j.type = 1 AND TRIM(j.value) <> ''
    ) nomes
    WHERE NOT EXISTS (SELECT 1 FROM acesso.rede_parceiro_nomes n WHERE n.nome = nomes.nome AND n.cnpj = l.cnpj);
    COMMIT;
END;
