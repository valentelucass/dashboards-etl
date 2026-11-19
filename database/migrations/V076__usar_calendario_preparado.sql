SET XACT_ABORT ON;
SET LOCK_TIMEOUT 5000;
IF DB_NAME() NOT IN ('DASHBOARDS_DEV','DASHBOARDS') OR @@TRANCOUNT=0
    THROW 51330,'A troca exige uma transacao do Flyway no banco do painel.',1;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'DASHBOARDS_ETL_SOURCE_SWITCH',@LockMode='Exclusive',
    @LockOwner='Transaction',@LockTimeout=5000;
IF @lock<0 THROW 51331,'Troca da origem em andamento.',1;
IF NOT EXISTS(SELECT 1 FROM ETL_SISTEMA_V2.ctl.dashboard_calendario_publicacao WHERE id=1)
    OR NOT EXISTS(SELECT 1 FROM ETL_SISTEMA_V2.pub.dim_calendario_preparada)
    THROW 51332,'Preparar o calendario na V2 antes da troca.',1;
DECLARE @anterior int=OBJECT_ID('ETL_SISTEMA_V2.pub.dim_calendario','V');
DECLARE @nova int=OBJECT_ID('ETL_SISTEMA_V2.pub.dim_calendario_preparada','V');
IF @anterior IS NULL OR @nova IS NULL OR EXISTS (
    SELECT column_id,name,system_type_id,max_length,precision,scale FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@anterior
    EXCEPT SELECT column_id,name,system_type_id,max_length,precision,scale FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@nova)
    OR EXISTS (
    SELECT column_id,name,system_type_id,max_length,precision,scale FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@nova
    EXCEPT SELECT column_id,name,system_type_id,max_length,precision,scale FROM ETL_SISTEMA_V2.sys.columns WHERE object_id=@anterior)
    THROW 51333,'Colunas do calendario divergentes.',1;
IF NOT EXISTS(SELECT 1 FROM sys.synonyms WHERE object_id=OBJECT_ID('dbo.dim_calendario')
    AND PARSENAME(base_object_name,3)='ETL_SISTEMA_V2' AND PARSENAME(base_object_name,2)='pub'
    AND PARSENAME(base_object_name,1)='dim_calendario')
    OR EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID('dbo.dim_calendario'))
    THROW 51334,'Conferir a origem e as permissoes do calendario.',1;
DROP SYNONYM dbo.dim_calendario;
CREATE SYNONYM dbo.dim_calendario FOR ETL_SISTEMA_V2.pub.dim_calendario_preparada;
SET LOCK_TIMEOUT -1;
