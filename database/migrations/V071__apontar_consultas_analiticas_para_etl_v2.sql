-- Troca as consultas analíticas do portal para as publicações da V2.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 5000;

IF DB_NAME() NOT IN (N'DASHBOARDS', N'DASHBOARDS_DEV') OR @@TRANCOUNT = 0
    THROW 51300, 'A troca exige o banco do portal e uma transacao do Flyway.', 1;

DECLARE @lock int;
EXEC @lock = sys.sp_getapplock
    @Resource = N'DASHBOARDS_ETL_SOURCE_SWITCH',
    @LockMode = N'Exclusive',
    @LockOwner = N'Transaction',
    @LockTimeout = 5000;
IF @lock < 0
    THROW 51301, 'Ja existe uma troca da origem do portal em andamento.', 1;

DECLARE @routes TABLE (name sysname PRIMARY KEY);
INSERT @routes (name) VALUES
    (N'dim_calendario'),
    (N'fato_fretes_faturamento'),
    (N'fato_gestao_vista_coletores'),
    (N'fato_gestao_vista_faturas'),
    (N'fato_gestao_vista_fretes'),
    (N'log_extracoes'),
    (N'raster_viagem_paradas'),
    (N'raster_viagens'),
    (N'vw_bi_monitoramento'),
    (N'vw_coletas_powerbi'),
    (N'vw_contas_a_pagar_powerbi'),
    (N'vw_cotacoes_powerbi'),
    (N'vw_dim_clientes'),
    (N'vw_dim_filiais'),
    (N'vw_dim_motoristas'),
    (N'vw_dim_planocontas'),
    (N'vw_dim_usuarios'),
    (N'vw_dim_veiculos'),
    (N'vw_fato_manifestos_dash'),
    (N'vw_faturas_por_cliente_powerbi'),
    (N'vw_fretes_powerbi'),
    (N'vw_inventario_powerbi'),
    (N'vw_localizacao_cargas_powerbi'),
    (N'vw_manifestos_powerbi'),
    (N'vw_raster_sm_transit_time'),
    (N'vw_sinistros_powerbi');

IF EXISTS (
    SELECT name FROM @routes
    EXCEPT
    SELECT s.name FROM sys.synonyms s
    WHERE s.schema_id = SCHEMA_ID(N'dbo')
      AND PARSENAME(s.base_object_name, 4) IS NULL
      AND PARSENAME(s.base_object_name, 3) = N'ETL_SISTEMA'
      AND PARSENAME(s.base_object_name, 2) = N'dbo'
      AND PARSENAME(s.base_object_name, 1) = s.name
)
    THROW 51302, 'O mapa atual de consultas do portal difere do mapa aprovado.', 1;

IF EXISTS (
    SELECT 1 FROM sys.database_permissions p
    JOIN sys.synonyms s ON p.class = 1 AND p.major_id = s.object_id
    JOIN @routes r ON r.name = s.name
    WHERE s.schema_id = SCHEMA_ID(N'dbo')
)
    THROW 51303, 'Uma consulta possui permissoes diretas que precisam ser preservadas.', 1;

IF EXISTS (
    SELECT 1 FROM @routes
    WHERE OBJECT_ID(N'ETL_SISTEMA_V2.pub.' + QUOTENAME(name), N'V') IS NULL
)
    THROW 51304, 'Uma publicacao da V2 esta ausente ou inacessivel.', 1;

DECLARE @ddl nvarchar(max);
SELECT @ddl = STRING_AGG(CONVERT(nvarchar(max),
    N'DROP SYNONYM dbo.' + QUOTENAME(name)
    + N'; CREATE SYNONYM dbo.' + QUOTENAME(name)
    + N' FOR ETL_SISTEMA_V2.pub.' + QUOTENAME(name) + N';'), CHAR(10))
FROM @routes;
EXEC sys.sp_executesql @ddl;

SET LOCK_TIMEOUT -1;
