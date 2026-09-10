-- Estado transitório do dia, uma linha reutilizável por usuário; não é auditoria.
-- A rotina diária substitui o conteúdo expirado por [], sem exclusão física.
IF OBJECT_ID(N'acesso.usuario_navegacao_dia', N'U') IS NULL
BEGIN
    CREATE TABLE acesso.usuario_navegacao_dia (
        usuario_id BIGINT NOT NULL REFERENCES acesso.usuarios(id),
        dia DATE NOT NULL,
        visitas NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        indice_atual INT NOT NULL DEFAULT -1,
        rota_atual VARCHAR(100) NULL,
        fluxo_id VARCHAR(36) NULL,
        ultimo_pulso DATETIMEOFFSET(3) NULL,
        CONSTRAINT PK_usuario_navegacao_dia PRIMARY KEY (usuario_id),
        CONSTRAINT CK_usuario_navegacao_dia_json CHECK (ISJSON(visitas) = 1),
        CONSTRAINT CK_usuario_navegacao_dia_indice CHECK (indice_atual >= -1)
    );
    CREATE INDEX IX_usuario_navegacao_dia_dia ON acesso.usuario_navegacao_dia(dia);
END;
GO
