IF DB_NAME() NOT IN (N'DASHBOARDS_DEV',N'DASHBOARDS') OR @@TRANCOUNT=0
    THROW 51390,'Instalar a leitura do DRE na transacao do painel.',1;
IF OBJECT_ID(N'ETL_SISTEMA_V2.pub.dashboard_dre_pagar',N'V') IS NULL
    THROW 51391,'A leitura das apropriacoes do DRE ainda nao foi publicada pelo ETL.',1;
CREATE SYNONYM dbo.dashboard_dre_pagar FOR ETL_SISTEMA_V2.pub.dashboard_dre_pagar;
