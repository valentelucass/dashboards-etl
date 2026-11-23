CREATE TABLE acesso.rede_situacoes (
    cnpj varchar(14) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES acesso.rede_parceiros(cnpj),
    data_lista date NOT NULL, ativo bit NOT NULL, PRIMARY KEY (cnpj, data_lista)
);
INSERT acesso.rede_situacoes(cnpj,data_lista,ativo)
SELECT cnpj, CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time'), ativo
FROM acesso.rede_parceiros;
GO
CREATE TRIGGER acesso.rede_registrar_situacao ON acesso.rede_parceiros AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @dia date = CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time');
    DECLARE @mudancas TABLE(cnpj varchar(14) COLLATE Latin1_General_100_BIN2 PRIMARY KEY, ativo bit);
    INSERT @mudancas SELECT i.cnpj,i.ativo FROM inserted i LEFT JOIN deleted d ON i.cnpj=d.cnpj
        WHERE d.cnpj IS NULL OR d.ativo <> i.ativo;
    UPDATE s SET ativo=m.ativo FROM acesso.rede_situacoes s JOIN @mudancas m ON m.cnpj=s.cnpj WHERE data_lista=@dia;
    INSERT acesso.rede_situacoes(cnpj,data_lista,ativo) SELECT m.cnpj,@dia,m.ativo FROM @mudancas m
        WHERE NOT EXISTS(SELECT 1 FROM acesso.rede_situacoes s WHERE s.cnpj=m.cnpj AND s.data_lista=@dia);
END;
GO
-- O histórico anterior à primeira lista vem do serviço identificado. A data da fatura não encerra uma parceria.
CREATE FUNCTION acesso.rede_parceiro_no_servico(@cnpj varchar(14), @dia date)
RETURNS TABLE AS RETURN
    SELECT p.nome_fantasia AS parceiro FROM acesso.rede_parceiros p
    OUTER APPLY (SELECT TOP (1) s.ativo FROM acesso.rede_situacoes s
                 WHERE s.cnpj=p.cnpj AND s.data_lista<=@dia ORDER BY s.data_lista DESC) situacao
    WHERE p.cnpj=@cnpj COLLATE Latin1_General_100_BIN2 AND ISNULL(situacao.ativo,1)=1;
GO
ALTER FUNCTION acesso.rede_executor_entrega(@minuta bigint, @manifesto bigint, @regiao nvarchar(255), @data_servico date)
RETURNS TABLE AS RETURN
    SELECT p.parceiro FROM (
        SELECT n.cnpj FROM acesso.rede_nomes_unicos n
        WHERE @manifesto IS NULL AND n.nome=@regiao COLLATE Latin1_General_100_CI_AI
        UNION ALL
        SELECT m.cnpj FROM acesso.rede_manifestos_parceiros m WHERE m.manifesto=@manifesto
    ) executor CROSS APPLY acesso.rede_parceiro_no_servico(executor.cnpj,@data_servico) p
    WHERE NOT EXISTS(SELECT 1 FROM dbo.dashboard_performance_ocorrencias retirada
                     WHERE retirada.minuta=@minuta AND retirada.codigo=136);
