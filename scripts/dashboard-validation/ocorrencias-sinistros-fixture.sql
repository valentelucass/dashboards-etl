-- Todas as fontes de movimento e de escrita desta prova são temporárias.
SELECT TOP(0) * INTO #fonte_sinistros FROM dbo.dashboard_sinistros;
CREATE TABLE #fretes ([Nº Minuta] bigint,[Data frete] datetimeoffset,[Tipo Frete] nvarchar(40),[Status] nvarchar(40),Filial nvarchar(20));
CREATE TABLE #eventos(escopo varchar(2),data_particao date,ordem bigint,minuta bigint,nota_fiscal nvarchar(40),codigo int,descricao nvarchar(100),ocorrido_em datetime2,filial nvarchar(20));
CREATE TABLE #prazos(escopo varchar(2),data_particao date,ordem bigint,prazo datetimeoffset,solucao datetimeoffset);
CREATE TABLE #cobertura(dia date); CREATE TABLE #cobertura_s(entidade varchar(10),dia date);
CREATE TABLE #apolices(id int,numero nvarchar(120),inicio date,fim date,valor_segurado decimal(19,2));
CREATE TABLE #ajustes(numero bigint,status_corretora nvarchar(20),franquia decimal(19,2),salvados decimal(19,2),revisao int);
INSERT #fretes VALUES (101,'2026-11-02T10:00:00-03:00','Normal','finalizado','A'),(101,'2026-11-02T10:00:00-03:00','Normal','finalizado','A'),
 (102,'2026-11-02T10:00:00-03:00','Normal','finalizado','B'),(103,'2026-11-03T10:00:00-03:00','Normal','finalizado','A'),
 (104,'2026-11-02T10:00:00-03:00','Normal','cancelado','A'),(105,'2026-11-02T10:00:00-03:00','Complementary','finalizado','A');
INSERT #eventos VALUES ('X','20261102',1,101,'001',78,N'Avaria total','20261102','A'),('X','20261102',2,101,'001',79,N'Avaria parcial','20261102','A'),
 ('X','20261102',3,102,'001',78,N'Avaria total','20261102','B'),('X','20261102',4,102,'001',78,N'Avaria total','20261102','B'),
 ('X','20261102',5,101,'002',43,N'Feriado','20261102','A');
INSERT #prazos VALUES ('X','20261102',1,'2026-11-03T10:00:00-03:00','2026-11-03T12:59:59+00:00'),('X','20261102',2,'2026-11-03T10:00:00-03:00','2026-11-03T13:00:00+00:00'),
 ('X','20261102',3,'2026-11-03T10:00:00-03:00',NULL),('X','20261102',4,NULL,NULL),('X','20261102',5,'20261103','20261102');
INSERT #fonte_sinistros ([Nº do Sinistro],[Minuta],[Nota Fiscal/Número],[Data ocorrência],[Data abertura],[Data finalização],[Valor NF],[valor a pagar ao cliente],[Valor nota de crédito ao cliente],[Valor a receber da seguradora],[Filial/Nome],[Nº da apólice])
VALUES (1,100,'x','20261030','20261030','20261031',450,90,10,80,'A','001'),
 (2,101,'001','20261102','20261101','20261107',800,200,30,75,'A','001'),(2,102,'002','20261102','20261101','20261107',800,200,30,75,'A','001'),
 (2,102,'002','20261102','20261101','20261107',800,200,30,75,'A','001'),(3,NULL,NULL,'20261104','20261104',NULL,220,40,0,0,'B',''),
 (4,103,'005','20261201','20261201',NULL,88,20,0,0,'A','002');
INSERT #ajustes VALUES (1,N'Finalizado',5,10,1),(2,N'Em Andamento',20,15,1);
INSERT #apolices VALUES (1,'001','20261001','20261130',1000),(2,'002','20261201','20261231',500);
