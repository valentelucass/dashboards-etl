SET NOCOUNT ON;
DECLARE @de date=:inicio, @ate date=:fim;
DROP TABLE IF EXISTS #os_casos,#os_visiveis,#os_pagina;
-- O saldo começa no início da vigência, mesmo quando o filtro exibe só um dia.
WITH apurados AS (
 SELECT s.*, a.status_corretora AS statusCorretora,a.franquia,a.salvados,ISNULL(a.revisao,0) revisao,
        p.id AS apoliceId,p.valor_segurado
 FROM acesso.sinistros_casos s LEFT JOIN acesso.sinistro_acompanhamento a ON s.numero=a.numero
 OUTER APPLY (SELECT CASE WHEN COUNT(*)=1 THEN MIN(p.id) END id,
                     CASE WHEN COUNT(*)=1 THEN MIN(p.valor_segurado) END valor_segurado
              FROM acesso.sinistro_apolices p WHERE s.ocorrido BETWEEN p.inicio AND p.fim
              AND (s.apolice IS NULL OR s.apolice COLLATE DATABASE_DEFAULT=p.numero)) p
), saldos AS (
 SELECT *, SUM(prejuizo-COALESCE(franquia,0)) OVER (PARTITION BY apoliceId ORDER BY ocorrido,numero ROWS UNBOUNDED PRECEDING) consumido,
           SUM(COALESCE(salvados,0)) OVER (PARTITION BY apoliceId ORDER BY ocorrido,numero ROWS UNBOUNDED PRECEDING) recuperado,
           COUNT(CASE WHEN prejuizo IS NULL THEN 1 END) OVER (PARTITION BY apoliceId ORDER BY ocorrido,numero ROWS UNBOUNDED PRECEDING) incompletos
 FROM apurados
)
SELECT *, CASE WHEN :global=1 AND apoliceId IS NOT NULL AND incompletos=0 THEN valor_segurado-consumido END AS sinistralidade,
          CASE WHEN :global=1 AND apoliceId IS NOT NULL AND incompletos=0 THEN valor_segurado-consumido+recuperado END AS sinistralidadeReal
INTO #os_casos FROM saldos s WHERE 1=1 /* escopoCaso */;

SELECT * INTO #os_visiveis FROM #os_casos WHERE ocorrido>=@de AND ocorrido<@ate;
SELECT * INTO #os_pagina FROM #os_visiveis ORDER BY ocorrido DESC,numero DESC OFFSET :deslocamento ROWS FETCH NEXT :limite ROWS ONLY;

WITH docs AS (
 SELECT s.[Nº do Sinistro] numero,s.[Minuta] minuta,NULLIF(TRIM(s.[Nota Fiscal/Número]),'') nota,
        NULLIF(TRIM(s.[Pagador do frete/Nome fantasia]),'') cliente
 FROM dbo.dashboard_sinistros s JOIN #os_pagina p ON p.numero=s.[Nº do Sinistro]
), clientes AS (
 SELECT numero,STRING_AGG(CONVERT(nvarchar(max),cliente),N', ') WITHIN GROUP (ORDER BY cliente) lista
 FROM (SELECT DISTINCT numero,cliente FROM docs WHERE cliente IS NOT NULL) d GROUP BY numero
), minutas AS (
 SELECT numero,STRING_AGG(CONVERT(nvarchar(max),minuta),N', ') WITHIN GROUP (ORDER BY minuta) lista
 FROM (SELECT DISTINCT numero,minuta FROM docs WHERE minuta IS NOT NULL) d GROUP BY numero
), notas AS (
 SELECT numero,STRING_AGG(CONVERT(nvarchar(max),nota),N', ') WITHIN GROUP (ORDER BY nota) lista
 FROM (SELECT DISTINCT numero,nota FROM docs WHERE nota IS NOT NULL) d GROUP BY numero
)
SELECT (SELECT (SELECT COUNT(*) FROM #os_visiveis) total,
        (SELECT AVG(CONVERT(decimal(18,3),DATEDIFF(day,abertura,finalizacao))) FROM #os_casos WHERE finalizacao>=@de AND finalizacao<@ate AND abertura<=finalizacao) mediaDias,
        (SELECT COUNT(*) FROM #os_casos WHERE finalizacao>=@de AND finalizacao<@ate AND abertura<=finalizacao) encerrados,
        JSON_QUERY((SELECT finalizacao AS dia,AVG(CONVERT(decimal(18,3),DATEDIFF(day,abertura,finalizacao))) media FROM #os_casos
                    WHERE finalizacao>=@de AND finalizacao<@ate AND abertura<=finalizacao GROUP BY finalizacao ORDER BY finalizacao FOR JSON PATH)) prazos,
        JSON_QUERY((SELECT s.numero,s.ocorrido,s.abertura,s.finalizacao,
                    CASE WHEN s.finalizacao IS NULL THEN N'Em aberto' ELSE N'Finalizado' END status,
                    c.lista cliente,m.lista minutas,n.lista notas,s.valorNf,s.seguradora,s.processo,
                    ISNULL(s.statusCorretora,N'Pendente') statusCorretora,s.prejuizo,s.aReceber,s.franquia,s.salvados,
                    s.sinistralidade,s.sinistralidadeReal,s.revisao,
                    CONVERT(bit,CASE WHEN s.sinistralidade IS NOT NULL AND (
                       (SELECT COUNT(*) FROM dbo.dashboard_cobertura_sinistros cob
                        WHERE cob.entidade='SINISTROS' AND cob.dia BETWEEN ap.inicio AND s.ocorrido)<DATEDIFF(day,ap.inicio,s.ocorrido)+1
                       OR EXISTS (SELECT 1 FROM #os_casos pend WHERE pend.apolice IS NULL AND pend.apoliceId IS NULL
                           AND pend.ocorrido BETWEEN ap.inicio AND s.ocorrido
                           AND (pend.ocorrido<s.ocorrido OR pend.numero<=s.numero))
                    ) THEN 1 ELSE 0 END) saldoParcial
                    FROM #os_pagina s LEFT JOIN acesso.sinistro_apolices ap ON ap.id=s.apoliceId
                    LEFT JOIN clientes c ON s.numero=c.numero LEFT JOIN minutas m ON s.numero=m.numero LEFT JOIN notas n ON s.numero=n.numero
                    ORDER BY s.ocorrido DESC,s.numero DESC FOR JSON PATH, INCLUDE_NULL_VALUES)) linhas
       FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER) AS resultado;
