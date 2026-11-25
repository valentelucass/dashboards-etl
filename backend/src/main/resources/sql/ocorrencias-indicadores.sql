SET NOCOUNT ON;
DECLARE @de date=:inicio, @ate date=:fim;
DECLARE @deFrete datetimeoffset=CONVERT(datetime2,@de) AT TIME ZONE 'E. South America Standard Time',
        @ateFrete datetimeoffset=CONVERT(datetime2,@ate) AT TIME ZONE 'E. South America Standard Time';
DROP TABLE IF EXISTS #os_fretes,#os_eventos,#os_tratativas,#os_taxa,#os_notas_grupo,#os_tipos;

SELECT f.[Nº Minuta] minuta, MIN(CONVERT(date,f.[Data frete] AT TIME ZONE 'E. South America Standard Time')) dia
INTO #os_fretes FROM dbo.vw_fretes_powerbi f
WHERE f.[Data frete]>=@deFrete AND f.[Data frete]<@ateFrete AND f.[Nº Minuta] IS NOT NULL
  AND ISNULL(f.[Tipo Frete],'') NOT IN ('Complementary','Substitute')
  AND ISNULL(f.[Status],'') NOT IN (N'cancelado',N'cancelada',N'canceled',N'cancelled')
  /* escopoFrete */
GROUP BY f.[Nº Minuta];
CREATE UNIQUE CLUSTERED INDEX IX_os_fretes ON #os_fretes(minuta);

SELECT o.escopo,o.data_particao,o.ordem,o.minuta,o.nota_fiscal AS nota,o.codigo,
       COALESCE(o.descricao,N'Sem descrição') descricao, COALESCE(g.grupo,N'Sem classificação') grupo,
       g.abre_tratativa
INTO #os_eventos FROM dbo.dashboard_performance_ocorrencias o
LEFT JOIN acesso.sinistro_grupos_ocorrencia g ON g.codigo=o.codigo
WHERE o.data_particao>=DATEADD(day,-1,@de) AND o.data_particao<DATEADD(day,1,@ate)
  AND o.ocorrido_em>=@de AND o.ocorrido_em<@ate /* escopoEvento */;
CREATE INDEX IX_os_evento_tratativa ON #os_eventos(escopo,data_particao,ordem) INCLUDE(minuta,nota) WHERE abre_tratativa=1;

SELECT e.minuta,e.nota,t.prazo,t.solucao INTO #os_tratativas FROM #os_eventos e
JOIN dbo.dashboard_ocorrencias_tratativas t ON t.escopo=e.escopo AND t.data_particao=e.data_particao AND t.ordem=e.ordem
WHERE e.abre_tratativa=1
OPTION(RECOMPILE,MAXDOP 1);

WITH minutas_sinistradas AS (
 SELECT DISTINCT s.Minuta FROM dbo.dashboard_sinistros s
 WHERE s.[Nº do Sinistro] IS NOT NULL AND s.[Data ocorrência]>=@de AND s.[Data ocorrência]<@ate /* escopoSinistro */
)
SELECT f.dia,COUNT_BIG(*) total,COUNT_BIG(s.Minuta) afetadas INTO #os_taxa
FROM #os_fretes f LEFT JOIN minutas_sinistradas s ON s.Minuta=f.minuta GROUP BY f.dia;

-- Grupos e tipos contam documentos em universos diferentes. Uma NF pode pertencer a vários tipos.
SELECT grupo,codigo,descricao,SUM(lancamentos) quantidade,
       COUNT_BIG(CASE WHEN minuta IS NOT NULL AND nota IS NOT NULL THEN 1 END) notas
INTO #os_tipos
FROM (
  SELECT grupo,codigo,descricao,minuta,nota,COUNT_BIG(*) lancamentos
  FROM #os_eventos GROUP BY grupo,codigo,descricao,minuta,nota
) t GROUP BY grupo,codigo,descricao;

SELECT grupo,minuta,nota INTO #os_notas_grupo
FROM #os_eventos WHERE minuta IS NOT NULL AND nota IS NOT NULL GROUP BY grupo,minuta,nota;

WITH notas AS (
 SELECT minuta,nota FROM #os_notas_grupo GROUP BY minuta,nota
), grupos_notas AS (
 SELECT grupo,COUNT_BIG(*) notas FROM #os_notas_grupo GROUP BY grupo
), abertas AS (
 SELECT DISTINCT minuta,nota FROM #os_tratativas WHERE solucao IS NULL AND minuta IS NOT NULL AND nota IS NOT NULL
), fretes_com_eventos AS (
 SELECT COUNT_BIG(DISTINCT e.minuta) comOcorrencia,COUNT_BIG(*) eventosDasMinutas
 FROM #os_eventos e JOIN #os_fretes f ON f.minuta=e.minuta
), cobertura AS (
 SELECT (SELECT COUNT(*) FROM dbo.customer_service_cobertura_ocorrencias WHERE dia>=@de AND dia<@ate) diasOcorrencias,
        (SELECT COUNT(*) FROM dbo.dashboard_cobertura_sinistros WHERE entidade='FRETES' AND dia>=@de AND dia<@ate) diasFretes,
        (SELECT COUNT(*) FROM dbo.dashboard_cobertura_sinistros WHERE entidade='SINISTROS' AND dia>=@de AND dia<@ate) diasSinistros
)
SELECT (SELECT DATEDIFF(day,@de,@ate) AS dias, c.diasOcorrencias,c.diasFretes,c.diasSinistros,
       (SELECT COUNT_BIG(*) FROM #os_fretes) minutas,
       ev.comOcorrencia,ev.eventosDasMinutas,
       (SELECT COUNT_BIG(*) FROM notas) notas,
       (SELECT COUNT_BIG(*) FROM abertas) emTratativa,
       (SELECT COUNT_BIG(prazo) FROM #os_tratativas) comPrazo,
       (SELECT COUNT_BIG(*) FROM #os_tratativas WHERE solucao<prazo) noPrazo,
       (SELECT COALESCE(SUM(afetadas),0) FROM #os_taxa) minutasComSinistro,
       JSON_QUERY((SELECT grupo,codigo,descricao,quantidade,notas FROM #os_tipos
           ORDER BY quantidade DESC,grupo,codigo,descricao FOR JSON PATH, INCLUDE_NULL_VALUES)) tipos,
       JSON_QUERY((SELECT COALESCE(o.grupo,N'Sem classificação') grupo,COALESCE(MAX(n.notas),0) notas,SUM(o.quantidade) quantidade
          FROM #os_tipos o LEFT JOIN grupos_notas n ON n.grupo=o.grupo GROUP BY o.grupo ORDER BY SUM(o.quantidade) DESC,o.grupo FOR JSON PATH)) grupos,
       JSON_QUERY((SELECT dia,total,afetadas FROM #os_taxa ORDER BY dia FOR JSON PATH)) evolucao
       FROM cobertura c CROSS JOIN fretes_com_eventos ev FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS resultado;
