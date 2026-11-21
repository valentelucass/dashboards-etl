IF NOT EXISTS (SELECT 1 FROM acesso.permissoes WHERE chave_legado = 'customerService')
    INSERT INTO acesso.permissoes (chave, chave_legado, nome, descricao, recurso, acao, rota)
    VALUES ('dashboard.customer_service.read', 'customerService', N'Customer Service',
            N'Indicadores de atendimento de clientes Key Account', 'customer_service', 'read', '/customer-service');

CREATE TABLE acesso.customer_service_contas (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nome NVARCHAR(200) NOT NULL,
    ativa BIT NOT NULL DEFAULT 1,
    CONSTRAINT CK_customer_service_contas_nome CHECK (LEN(LTRIM(RTRIM(nome))) > 0)
);

CREATE TABLE acesso.customer_service_documentos (
    conta_id BIGINT NOT NULL REFERENCES acesso.customer_service_contas(id),
    documento VARCHAR(14) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
    CONSTRAINT CK_customer_service_documento_completo CHECK (
        DATALENGTH(documento) = 14 AND documento NOT LIKE '%[^0-9A-Z]%'
    )
);

CREATE INDEX IX_customer_service_documentos_conta ON acesso.customer_service_documentos(conta_id);

CREATE SYNONYM dbo.customer_service_cobertura_ocorrencias
    FOR ETL_SISTEMA_V2.pub.customer_service_cobertura_ocorrencias;
