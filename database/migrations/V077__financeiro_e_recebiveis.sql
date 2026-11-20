IF DB_NAME() NOT IN ('DASHBOARDS_DEV','DASHBOARDS') OR @@TRANCOUNT=0
    THROW 51335,'A integracao financeira exige a transacao do painel.',1;
IF NOT EXISTS(SELECT 1 FROM ETL_SISTEMA_V2.pub.dashboard_financeiro_fretes)
    OR NOT EXISTS(SELECT 1 FROM ETL_SISTEMA_V2.pub.dashboard_parcelas_recebiveis)
    THROW 51336,'Aguardar a primeira conciliacao de parcelas e fretes no ESL.',1;
CREATE SYNONYM dbo.dashboard_financeiro_fretes FOR ETL_SISTEMA_V2.pub.dashboard_financeiro_fretes;
CREATE SYNONYM dbo.dashboard_parcelas_recebiveis FOR ETL_SISTEMA_V2.pub.dashboard_parcelas_recebiveis;
