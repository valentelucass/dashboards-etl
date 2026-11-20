IF DB_NAME() NOT IN ('DASHBOARDS_DEV','DASHBOARDS') OR @@TRANCOUNT = 0
    THROW 51337, 'Instalar a leitura de ocorrencias na transacao do painel.', 1;

IF NOT EXISTS (SELECT 1 FROM ETL_SISTEMA_V2.pub.dashboard_performance_ocorrencias)
    THROW 51338, 'Aguardar a publicacao das ocorrencias de performance.', 1;

CREATE SYNONYM dbo.dashboard_performance_ocorrencias
    FOR ETL_SISTEMA_V2.pub.dashboard_performance_ocorrencias;
