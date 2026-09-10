-- =============================================================
-- Schema de controle de acesso (autorizacao + auditoria)
-- Banco: DASHBOARDS  |  Schema: acesso
-- =============================================================

CREATE SCHEMA acesso;
GO

CREATE TABLE acesso.rate_limit_buckets (
    chave             VARCHAR(300) NOT NULL CONSTRAINT PK_rate_limit_buckets PRIMARY KEY,
    total_na_janela   INT NOT NULL CONSTRAINT CK_rate_limit_buckets_total_positivo CHECK (total_na_janela >= 0),
    expira_em         DATETIME2(3) NOT NULL,
    atualizado_em     DATETIME2(3) NOT NULL CONSTRAINT DF_rate_limit_buckets_atualizado DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_rate_limit_buckets_expira_em
    ON acesso.rate_limit_buckets (expira_em);
GO

-- -------------------------------------------------------------
-- SETORES (departamentos / areas de negocio)
-- -------------------------------------------------------------
CREATE TABLE acesso.setores (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    chave           VARCHAR(80)   NOT NULL UNIQUE,
    nome            NVARCHAR(120) NOT NULL UNIQUE,
    descricao       NVARCHAR(500) NULL,
    sistema         BIT           NOT NULL DEFAULT 0,
    ativo           BIT           NOT NULL DEFAULT 1,
    criado_em       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_em   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- -------------------------------------------------------------
-- PERMISSOES (catalogo de permissoes)
-- -------------------------------------------------------------
CREATE TABLE acesso.permissoes (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    chave           VARCHAR(100)  NOT NULL UNIQUE,
    chave_legado    VARCHAR(50)   NULL UNIQUE,
    nome            NVARCHAR(120) NOT NULL,
    descricao       NVARCHAR(500) NULL,
    recurso         VARCHAR(60)   NULL,
    acao            VARCHAR(30)   NOT NULL DEFAULT 'read',
    rota            VARCHAR(120)  NULL,
    ativo           BIT           NOT NULL DEFAULT 1,
    criado_em       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- -------------------------------------------------------------
-- PAPEIS (roles administrativos)
-- -------------------------------------------------------------
CREATE TABLE acesso.papeis (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    nome            VARCHAR(60)   NOT NULL UNIQUE,
    descricao       NVARCHAR(300) NULL,
    nivel           INT           NOT NULL DEFAULT 0,
    ativo           BIT           NOT NULL DEFAULT 1,
    criado_em       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- -------------------------------------------------------------
-- USUARIOS
-- -------------------------------------------------------------
CREATE TABLE acesso.usuarios (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    chave_legado        VARCHAR(80)  NULL UNIQUE,
    login               VARCHAR(80)  NOT NULL UNIQUE,
    nome                NVARCHAR(200) NOT NULL,
    email               VARCHAR(254) NOT NULL UNIQUE,
    senha_hash          VARCHAR(255) NOT NULL,
    algoritmo_hash      VARCHAR(20)  NOT NULL DEFAULT 'bcrypt',
    senha_alterada_em   DATETIME2    NULL,
    exige_troca_senha   BIT          NOT NULL DEFAULT 0,
    password_reset_requested_at DATETIME2 NULL,
    tentativas_falha    INT          NOT NULL DEFAULT 0,
    bloqueado_ate       DATETIME2    NULL,
    identity_source     VARCHAR(30)  NOT NULL DEFAULT 'local',
    external_subject_id VARCHAR(255) NULL,
    mfa_status          VARCHAR(20)  NOT NULL DEFAULT 'disabled',
    ultima_atividade    DATETIMEOFFSET NULL,
    ultima_rota_acessada VARCHAR(100) NULL,
    setor_id            BIGINT       NOT NULL REFERENCES acesso.setores(id),
    ativo               BIT          NOT NULL DEFAULT 1,
    criado_em           DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_em       DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_usuarios_password_reset_requested_at
    ON acesso.usuarios (password_reset_requested_at)
    WHERE password_reset_requested_at IS NOT NULL;

-- -------------------------------------------------------------
-- SEQUENCIAS DE APRESENTACAO PESSOAIS
-- -------------------------------------------------------------
CREATE TABLE acesso.apresentacao_sequencias (
    id             BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    usuario_id     BIGINT NOT NULL REFERENCES acesso.usuarios(id),
    nome           NVARCHAR(80) NOT NULL,
    ativo          BIT NOT NULL DEFAULT 1,
    criado_em      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_em  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE acesso.apresentacao_sequencia_itens (
    id             BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    sequencia_id   BIGINT NOT NULL REFERENCES acesso.apresentacao_sequencias(id),
    pagina         VARCHAR(60) NOT NULL,
    ordem          INT NOT NULL CHECK (ordem > 0),
    UNIQUE (sequencia_id, ordem),
    UNIQUE (sequencia_id, pagina)
);

CREATE INDEX IX_apresentacao_sequencias_usuario_ativo
    ON acesso.apresentacao_sequencias (usuario_id, ativo, atualizado_em DESC);

CREATE INDEX IX_apresentacao_sequencia_itens_sequencia_ordem
    ON acesso.apresentacao_sequencia_itens (sequencia_id, ordem);

-- -------------------------------------------------------------
-- COMUNICADOS DA HOME E CURTIDAS (interação por usuário)
-- -------------------------------------------------------------
CREATE TABLE acesso.home_comunicados (
    id             BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    titulo         NVARCHAR(140)        NOT NULL,
    corpo          NVARCHAR(700)        NOT NULL,
    tag            VARCHAR(20)          NOT NULL,
    publico_alvo   NVARCHAR(140)        NOT NULL DEFAULT N'Todos',
    publicado_em   DATETIME2(0)         NOT NULL DEFAULT SYSUTCDATETIME(),
    ativo          BIT                  NOT NULL DEFAULT 1,
    criado_por     NVARCHAR(120)        NULL,
    criado_em      DATETIME2(0)         NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_por NVARCHAR(120)        NULL,
    atualizado_em  DATETIME2(0)         NULL
);

CREATE TABLE acesso.home_comunicado_leituras (
    usuario_id BIGINT NOT NULL REFERENCES acesso.usuarios(id),
    comunicado_id BIGINT NOT NULL REFERENCES acesso.home_comunicados(id),
    versao_lida_em DATETIME2(7) NOT NULL,
    lido_em DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_home_comunicado_leituras PRIMARY KEY (usuario_id, comunicado_id)
);

CREATE TABLE acesso.home_comunicado_curtidas (
    id              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    comunicado_id   BIGINT NOT NULL REFERENCES acesso.home_comunicados(id),
    usuario_id      BIGINT NOT NULL REFERENCES acesso.usuarios(id),
    ativo           BIT NOT NULL DEFAULT 1,
    criado_em       DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_em   DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UX_home_comunicado_curtidas_ativa
    ON acesso.home_comunicado_curtidas (comunicado_id, usuario_id)
    WHERE ativo = 1;

CREATE INDEX IX_home_comunicado_curtidas_comunicado_ativo
    ON acesso.home_comunicado_curtidas (comunicado_id, ativo, usuario_id);

CREATE TABLE acesso.home_comunicado_comentarios (
    id              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    comunicado_id   BIGINT NOT NULL REFERENCES acesso.home_comunicados(id),
    usuario_id      BIGINT NOT NULL REFERENCES acesso.usuarios(id),
    corpo           NVARCHAR(700) NOT NULL,
    ativo           BIT NOT NULL DEFAULT 1,
    criado_em       DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_em   DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_home_comunicado_comentarios_comunicado_ativo_criado
    ON acesso.home_comunicado_comentarios (comunicado_id, ativo, criado_em, id);

-- -------------------------------------------------------------
-- SETOR_PERMISSAO_TEMPLATES (baseline de permissoes por setor)
-- -------------------------------------------------------------
CREATE TABLE acesso.setor_permissao_templates (
    setor_id        BIGINT NOT NULL REFERENCES acesso.setores(id),
    permissao_id    BIGINT NOT NULL REFERENCES acesso.permissoes(id),
    PRIMARY KEY (setor_id, permissao_id)
);

-- -------------------------------------------------------------
-- USUARIO_PAPEL_VINCULOS (atribuicao de papeis a usuarios)
-- -------------------------------------------------------------
CREATE TABLE acesso.usuario_papel_vinculos (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario_id      BIGINT   NOT NULL REFERENCES acesso.usuarios(id),
    papel_id        BIGINT   NOT NULL REFERENCES acesso.papeis(id),
    concedido_por   BIGINT   NULL     REFERENCES acesso.usuarios(id),
    concedido_em    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE(usuario_id, papel_id)
);

-- -------------------------------------------------------------
-- USUARIO_PERMISSAO_OVERRIDES (GRANT/DENY por usuario)
-- -------------------------------------------------------------
CREATE TABLE acesso.usuario_permissao_overrides (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario_id      BIGINT    NOT NULL REFERENCES acesso.usuarios(id),
    permissao_id    BIGINT    NOT NULL REFERENCES acesso.permissoes(id),
    tipo            VARCHAR(5) NOT NULL CHECK (tipo IN ('GRANT','DENY')),
    concedido_por   BIGINT    NULL     REFERENCES acesso.usuarios(id),
    concedido_em    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE(usuario_id, permissao_id)
);

-- -------------------------------------------------------------
-- AUDIT_LOGS
-- -------------------------------------------------------------
CREATE TABLE acesso.audit_logs (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    timestamp_utc   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    usuario_id      BIGINT        NULL     REFERENCES acesso.usuarios(id),
    usuario_login   VARCHAR(80)   NULL,
    acao            VARCHAR(60)   NOT NULL,
    recurso         VARCHAR(120)  NULL,
    detalhes_json   NVARCHAR(MAX) NULL,
    ip_address      VARCHAR(45)   NULL,
    user_agent      VARCHAR(500)  NULL
);

CREATE INDEX IX_audit_timestamp ON acesso.audit_logs(timestamp_utc DESC);
CREATE INDEX IX_audit_usuario   ON acesso.audit_logs(usuario_id, timestamp_utc DESC);
CREATE INDEX IX_audit_acao      ON acesso.audit_logs(acao, timestamp_utc DESC);

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
