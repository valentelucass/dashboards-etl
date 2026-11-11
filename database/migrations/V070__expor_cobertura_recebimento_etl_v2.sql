-- New operational read only. Existing analytical synonyms remain unchanged.
-- SQL Server defers target binding; the coverage endpoint handles absence explicitly.
CREATE SYNONYM dbo.vw_etl_v2_receiving_overview
    FOR ETL_SISTEMA_V2.pub.v2_dashboard_receiving_overview;
