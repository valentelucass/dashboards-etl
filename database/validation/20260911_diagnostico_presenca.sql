SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
IF DB_NAME() NOT IN (N'DASHBOARDS', N'DASHBOARDS_DEV')
    THROW 51000, 'Base fora do escopo do Dashboard.', 1;

-- Somente agregados, sem identidade, credencial ou conteúdo de navegação.
DECLARE @agora DATETIMEOFFSET(3) = SYSDATETIMEOFFSET();
SELECT @agora AS consultado_em,
       COUNT_BIG(*) AS contas_ativas,
       SUM(CASE WHEN n.rota_atual IS NOT NULL
                    AND n.ultimo_pulso >= DATEADD(SECOND, -75, @agora)
                    AND n.ultimo_pulso <= @agora THEN 1 ELSE 0 END) AS com_foco_recente,
       SUM(CASE WHEN n.rota_atual IS NULL
                    AND n.ultimo_pulso >= DATEADD(SECOND, -75, @agora)
                    AND n.ultimo_pulso <= @agora THEN 1 ELSE 0 END) AS com_saida_recente,
       SUM(CASE WHEN n.ultimo_pulso > @agora THEN 1 ELSE 0 END) AS pulso_futuro
  FROM acesso.usuarios u
  LEFT JOIN acesso.usuario_navegacao_dia n ON n.usuario_id = u.id
 WHERE u.ativo = 1;

;WITH por_pagina AS (
    SELECT n.usuario_id, v.rota, COUNT_BIG(*) AS trechos,
           SUM(v.segundos) AS segundos
      FROM acesso.usuario_navegacao_dia n
      JOIN acesso.usuarios u ON u.id = n.usuario_id AND u.ativo = 1
      CROSS APPLY OPENJSON(n.visitas) WITH (rota VARCHAR(100), segundos BIGINT) v
     WHERE n.dia = CAST(@agora AT TIME ZONE 'E. South America Standard Time' AS DATE)
     GROUP BY n.usuario_id, v.rota
)
SELECT COUNT_BIG(*) AS paginas_por_pessoa,
       COALESCE(SUM(trechos), 0) AS trechos_registrados,
       COALESCE(SUM(CASE WHEN trechos > 1 THEN 1 ELSE 0 END), 0) AS paginas_repetidas,
       COALESCE(MAX(trechos), 0) AS maximo_trechos_mesma_pagina,
       COALESCE(SUM(segundos), 0) AS segundos_registrados
  FROM por_pagina;
