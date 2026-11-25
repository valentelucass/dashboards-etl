IF DB_NAME() NOT IN (N'DASHBOARDS_DEV', N'DASHBOARDS') OR @@TRANCOUNT = 0
    THROW 51370, 'Instalar a base de sinistros na transacao do painel.', 1;

IF OBJECT_ID(N'ETL_SISTEMA_V2.pub.dashboard_sinistros', N'V') IS NULL
   OR OBJECT_ID(N'ETL_SISTEMA_V2.pub.dashboard_sinistros_ocorrencias_documento', N'V') IS NULL
    THROW 51371, 'As duas leituras de sinistros precisam estar publicadas no ETL.', 1;

CREATE SYNONYM dbo.dashboard_sinistros FOR ETL_SISTEMA_V2.pub.dashboard_sinistros;
CREATE SYNONYM dbo.dashboard_sinistros_ocorrencias_documento FOR ETL_SISTEMA_V2.pub.dashboard_sinistros_ocorrencias_documento;
