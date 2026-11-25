IF DB_NAME() NOT IN ('DASHBOARDS_DEV','DASHBOARDS') OR @@TRANCOUNT=0
    THROW 51380,'Executar na transação do dashboard.',1;
CREATE SYNONYM dbo.dashboard_ocorrencias_tratativas FOR ETL_SISTEMA_V2.pub.dashboard_ocorrencias_tratativas;
CREATE SYNONYM dbo.dashboard_cobertura_sinistros FOR ETL_SISTEMA_V2.pub.dashboard_cobertura_sinistros;

INSERT INTO acesso.permissoes (chave,chave_legado,nome,descricao,recurso,acao,rota) VALUES
 ('dashboard.sinistros.read','ocorrenciasSinistros',N'Ocorrências e Sinistros',N'Indicadores de ocorrências, tratativas e sinistros','sinistros','read','/ocorrencias-e-sinistros'),
 ('dashboard.sinistros.write','gerenciarSinistros',N'Gerenciar sinistros e apólices',N'Atualizar dados da corretora, franquias, salvados e vigências','sinistros','write',NULL);

CREATE TABLE acesso.sinistro_grupos_ocorrencia (
 codigo int PRIMARY KEY, grupo nvarchar(30) NOT NULL, abre_tratativa bit NOT NULL
);
-- Classificação e ação de cada código do catálogo de Operações de 23/11/2026.
INSERT INTO acesso.sinistro_grupos_ocorrencia(codigo,grupo,abre_tratativa) VALUES
(1,N'FINALIZA',0), (2,N'FINALIZA',0), (3,N'CLIENTE',1), (4,N'CLIENTE',1),
(5,N'CLIENTE',1), (6,N'CLIENTE',1), (7,N'TRATATIVA',1), (8,N'CLIENTE',1),
(9,N'CLIENTE',1), (10,N'CLIENTE',1), (11,N'TRANSPORTADORA',1), (12,N'TRATATIVA',1),
(13,N'TRATATIVA',1), (14,N'SINISTRO',1), (15,N'SINISTRO',1), (16,N'TRATATIVA',1),
(17,N'TRATATIVA',1), (18,N'TRATATIVA',1), (19,N'REENTREGA',0), (20,N'TRANSPORTADORA',0),
(21,N'CLIENTE',0), (22,N'REENTREGA',0), (23,N'SINISTRO',1), (24,N'FINALIZA',0),
(25,N'FINALIZA',0), (26,N'TRATATIVA',1), (27,N'SINISTRO',1), (28,N'TRATATIVA',1),
(29,N'FINALIZA',0), (30,N'TRANSPORTADORA',1), (31,N'FINALIZA',0), (32,N'TRATATIVA',1),
(33,N'TRATATIVA',1), (34,N'CLIENTE',1), (35,N'TRANSPORTADORA',1), (36,N'SINISTRO',1),
(37,N'SINISTRO',1), (38,N'AVARIA',1), (39,N'SINISTRO',1), (40,N'TRATATIVA',1),
(41,N'CLIENTE',1), (42,N'CLIENTE',1), (43,N'INFORMATIVO',0), (44,N'CLIENTE',0),
(45,N'CLIENTE',1), (46,N'CLIENTE',0), (47,N'CLIENTE',1), (48,N'INFORMATIVO',0),
(49,N'INFORMATIVO',0), (50,N'FINALIZA',0), (51,N'INFORMATIVO',0), (52,N'FINALIZA',0),
(53,N'DEVOLUÇÃO',0), (54,N'DEVOLUÇÃO',0), (55,N'TRANSPORTE',0), (56,N'TRANSPORTE',0),
(57,N'TRANSPORTADORA',1), (58,N'TRANSPORTADORA',0), (59,N'TRANSPORTADORA',1), (60,N'FINALIZA',0),
(61,N'INFORMATIVO',0), (62,N'CLIENTE',1), (63,N'FINALIZA',0), (64,N'TRATATIVA',1),
(65,N'FINALIZA',0), (66,N'CLIENTE',1), (67,N'INFORMATIVO',0), (68,N'TRATATIVA',1),
(69,N'FINALIZA',0), (70,N'INFORMATIVO',0), (71,N'CLIENTE',1), (72,N'CLIENTE',1),
(73,N'TRATATIVA',1), (74,N'TRANSPORTADORA',1), (75,N'TRANSPORTADORA',0), (76,N'TRATATIVA',1),
(77,N'CLIENTE',1), (78,N'AVARIA',1), (79,N'AVARIA',1), (80,N'SINISTRO',1),
(81,N'SINISTRO',1), (82,N'TRATATIVA',1), (83,N'INFORMATIVO',0), (84,N'INFORMATIVO',0),
(85,N'TRATATIVA',1), (86,N'INFORMATIVO',0), (87,N'CLIENTE',1), (88,N'CLIENTE',1),
(89,N'INFORMATIVO',0), (90,N'CLIENTE',1), (91,N'INFORMATIVO',0), (92,N'INFORMATIVO',1),
(93,N'INFORMATIVO',1), (94,N'CLIENTE',1), (95,N'INFORMATIVO',0), (96,N'TRATATIVA',1),
(97,N'TRATATIVA',1), (98,N'SINISTRO',1), (99,N'INFORMATIVO',0), (100,N'TRATATIVA',1),
(101,N'TRANSPORTE',0), (102,N'TRANSPORTE',0), (103,N'TRANSPORTE',0), (105,N'TRATATIVA',1),
(106,N'TRATATIVA',1), (107,N'INFORMATIVO',0), (108,N'INFORMATIVO',0), (109,N'INFORMATIVO',0),
(110,N'TRANSPORTE',0), (111,N'INFORMATIVO',0), (112,N'FINALIZA',0), (113,N'INFORMATIVO',0),
(114,N'INFORMATIVO',0), (115,N'INFORMATIVO',0), (116,N'CLIENTE',1), (117,N'TRANSPORTADORA',1),
(118,N'TRANSPORTADORA',1), (119,N'TRANSPORTADORA',1), (120,N'TRANSPORTADORA',1), (121,N'TRATATIVA',1),
(122,N'INFORMATIVO',0), (123,N'INFORMATIVO',0), (124,N'INFORMATIVO',0), (125,N'CLIENTE',1),
(126,N'INFORMATIVO',0), (127,N'INFORMATIVO',0), (128,N'TRANSPORTADORA',0), (129,N'TRANSPORTADORA',1),
(130,N'TRATATIVA',1), (131,N'CLIENTE',1), (132,N'TRANSPORTADORA',0), (133,N'INFORMATIVO',0),
(134,N'INFORMATIVO',0), (135,N'TRATATIVA',1), (136,N'FINALIZA',0), (137,N'FINALIZA',0),
(138,N'FINALIZA',0), (139,N'FINALIZA',0), (140,N'FINALIZA',0), (141,N'INFORMATIVO',1),
(142,N'FINALIZA',0), (143,N'FINALIZA',0), (144,N'INFORMATIVO',0), (145,N'TRATATIVA',1),
(146,N'TRATATIVA',1), (147,N'INFORMATIVO',0), (148,N'INFORMATIVO',0), (500,N'INFORMATIVO',0),
(501,N'INFORMATIVO',0), (502,N'INFORMATIVO',0), (503,N'INFORMATIVO',0), (504,N'INFORMATIVO',0),
(505,N'INFORMATIVO',1), (506,N'INFORMATIVO',1);

CREATE TABLE acesso.sinistro_apolices (
 id int IDENTITY PRIMARY KEY,
 numero nvarchar(120) NOT NULL,
 inicio date NOT NULL, fim date NOT NULL,
 valor_segurado decimal(19,2) NOT NULL CHECK(valor_segurado > 0),
 revisao int NOT NULL DEFAULT 1,
 alterado_por nvarchar(320) NOT NULL, alterado_em datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CHECK(fim >= inicio), CHECK(LEN(TRIM(numero))>0),
 UNIQUE(numero,inicio)
);
CREATE TABLE acesso.sinistro_acompanhamento (
 numero bigint PRIMARY KEY,
 status_corretora nvarchar(20) NOT NULL CHECK(status_corretora IN (N'Pendente',N'Em Andamento',N'Finalizado')),
 franquia decimal(19,2) NULL CHECK(franquia>=0),
 salvados decimal(19,2) NULL CHECK(salvados>=0),
 revisao int NOT NULL,
 alterado_por nvarchar(320) NOT NULL, alterado_em datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
-- O relatório 6392 repete valores do sinistro inteiro por documento e tratativa.
CREATE VIEW acesso.sinistros_casos AS
SELECT CAST([Nº do Sinistro] AS bigint) AS numero, MIN([Data ocorrência]) AS ocorrido, MIN([Data abertura]) AS abertura,
       MAX([Data finalização]) AS finalizacao,
       CASE WHEN MIN([Filial/Nome])=MAX([Filial/Nome]) THEN MAX([Filial/Nome]) END AS filial,
       MAX(NULLIF(TRIM([Seguradora/Nome]),'')) AS seguradora, MAX(NULLIF(TRIM([Nº do processo da corretora]),'')) AS processo,
       MAX(NULLIF(TRIM([Nº da apólice]),'')) AS apolice,
       CASE WHEN MIN([Valor NF])=MAX([Valor NF]) THEN MAX([Valor NF]) END AS valorNf,
       CASE WHEN MIN(COALESCE([valor a pagar ao cliente],0)+COALESCE([Valor nota de crédito ao cliente],0))=
                 MAX(COALESCE([valor a pagar ao cliente],0)+COALESCE([Valor nota de crédito ao cliente],0))
            THEN MAX(COALESCE([valor a pagar ao cliente],0)+COALESCE([Valor nota de crédito ao cliente],0)) END AS prejuizo,
       CASE WHEN MIN([Valor a receber da seguradora])=MAX([Valor a receber da seguradora]) THEN MAX([Valor a receber da seguradora]) END AS aReceber
FROM dbo.dashboard_sinistros WHERE [Nº do Sinistro] IS NOT NULL GROUP BY [Nº do Sinistro];
