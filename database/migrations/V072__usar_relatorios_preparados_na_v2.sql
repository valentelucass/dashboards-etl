SET XACT_ABORT ON;
SET LOCK_TIMEOUT 5000;
IF DB_NAME() NOT IN ('DASHBOARDS_DEV','DASHBOARDS') OR @@TRANCOUNT=0
    THROW 51310,'A troca exige uma transacao do Flyway no banco do painel.',1;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'DASHBOARDS_ETL_SOURCE_SWITCH',@LockMode='Exclusive',
    @LockOwner='Transaction',@LockTimeout=5000;
IF @lock<0 THROW 51311,'Troca da origem em andamento.',1;
IF NOT EXISTS(SELECT 1 FROM ETL_SISTEMA_V2.ctl.dashboard_fretes_publicados WHERE publicacao=1)
    OR EXISTS(SELECT 1 FROM ETL_SISTEMA_V2.pub.vw_dashboard_particoes_pendentes)
    THROW 51312,'Concluir a publicacao na V2 antes da troca.',1;

DECLARE @routes TABLE(name sysname PRIMARY KEY);
INSERT @routes VALUES ('vw_coletas_powerbi'),('vw_cotacoes_powerbi'),('vw_fretes_powerbi'),
    ('fato_fretes_faturamento'),('fato_gestao_vista_fretes');
IF EXISTS(SELECT 1 FROM @routes r WHERE NOT EXISTS(
        SELECT 1 FROM sys.synonyms s WHERE s.schema_id=SCHEMA_ID('dbo') AND s.name=r.name
        AND PARSENAME(s.base_object_name,3)='ETL_SISTEMA_V2' AND PARSENAME(s.base_object_name,2)='pub'
        AND PARSENAME(s.base_object_name,1)=r.name AND PARSENAME(s.base_object_name,4) IS NULL))
    THROW 51313,'Origem anterior divergente.',1;
IF EXISTS(SELECT 1 FROM @routes r JOIN sys.synonyms s ON s.schema_id=SCHEMA_ID('dbo') AND s.name=r.name
           JOIN sys.database_permissions p ON p.class=1 AND p.major_id=s.object_id)
    THROW 51314,'Permissoes do sinonimo precisam ser preservadas.',1;
DECLARE @name sysname,@original int,@prepared int,@sql nvarchar(max);
DECLARE routes CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @routes;
OPEN routes; FETCH NEXT FROM routes INTO @name;
WHILE @@FETCH_STATUS=0
BEGIN
    SET @original=OBJECT_ID(N'ETL_SISTEMA_V2.pub.'+QUOTENAME(@name),'V');
    SET @prepared=OBJECT_ID(N'ETL_SISTEMA_V2.pub.'+QUOTENAME(@name+'_preparada'),'V');
    IF @original IS NULL OR @prepared IS NULL OR EXISTS(
        SELECT column_id,name,system_type_id,max_length,precision,scale FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@original
        EXCEPT SELECT column_id,name,system_type_id,max_length,precision,scale FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@prepared)
       OR EXISTS(SELECT column_id,name FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@prepared
                 EXCEPT SELECT column_id,name FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@original)
        THROW 51315,'Colunas da publicacao divergentes.',1;
    SET @sql=N'DROP SYNONYM dbo.'+QUOTENAME(@name)+N'; CREATE SYNONYM dbo.'+QUOTENAME(@name)
        +N' FOR ETL_SISTEMA_V2.pub.'+QUOTENAME(@name+'_preparada')+N';';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM routes INTO @name;
END;
CLOSE routes; DEALLOCATE routes;
SET LOCK_TIMEOUT -1;
