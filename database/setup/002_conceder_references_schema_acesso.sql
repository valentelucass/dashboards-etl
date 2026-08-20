:setvar TargetDb DASHBOARDS
:setvar AppLogin usuario_etl

/*
  Executar uma única vez por administrador do SQL Server, antes de migrations
  que criem chaves estrangeiras no schema acesso.
*/
IF DB_ID(N'$(TargetDb)') IS NULL
    THROW 51010, 'Database de destino não encontrada.', 1;
GO

USE [$(TargetDb)];
GO

IF SUSER_ID(N'$(AppLogin)') IS NULL
    THROW 51011, 'Login da aplicação não encontrado.', 1;

IF DATABASE_PRINCIPAL_ID(N'$(AppLogin)') IS NULL
    CREATE USER [$(AppLogin)] FOR LOGIN [$(AppLogin)];
GO

GRANT REFERENCES ON SCHEMA::acesso TO [$(AppLogin)];
GO
