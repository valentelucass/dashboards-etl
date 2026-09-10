-- Estado de leitura por usuário; somente no banco próprio do Dashboard.
IF OBJECT_ID(N'acesso.home_comunicado_leituras', N'U') IS NULL
BEGIN
    CREATE TABLE acesso.home_comunicado_leituras (
        usuario_id BIGINT NOT NULL REFERENCES acesso.usuarios(id),
        comunicado_id BIGINT NOT NULL REFERENCES acesso.home_comunicados(id),
        versao_lida_em DATETIME2(7) NOT NULL,
        lido_em DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_home_comunicado_leituras PRIMARY KEY (usuario_id, comunicado_id)
    );
END;
GO
