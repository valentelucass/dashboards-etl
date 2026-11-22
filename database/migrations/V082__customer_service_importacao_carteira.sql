ALTER TABLE acesso.customer_service_documentos
    ADD ativo BIT NOT NULL CONSTRAINT DF_customer_service_documento_ativo DEFAULT 1 WITH VALUES;

CREATE TABLE acesso.customer_service_carteira_revisao (
    id TINYINT NOT NULL PRIMARY KEY CHECK (id = 1),
    versao BIGINT NOT NULL CHECK (versao >= 0),
    competencia DATE NULL,
    hash_carteira CHAR(64) NULL
);
INSERT INTO acesso.customer_service_carteira_revisao (id, versao) VALUES (1, 0);

CREATE TABLE acesso.customer_service_carteira_importacoes (
    versao BIGINT NOT NULL PRIMARY KEY,
    competencia DATE NOT NULL,
    hash_carteira CHAR(64) NOT NULL,
    importado_por NVARCHAR(320) NOT NULL,
    importado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    grupos INT NOT NULL,
    cnpjs INT NOT NULL,
    adicionados INT NOT NULL,
    removidos INT NOT NULL,
    transferidos INT NOT NULL
);
