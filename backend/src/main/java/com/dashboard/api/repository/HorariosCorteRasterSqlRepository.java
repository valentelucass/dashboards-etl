package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.indicadoresgestao.HorariosCorteSeriePointDTO;
import com.dashboard.api.dto.PaginaDTO;
import com.dashboard.api.model.VisaoHorariosCorteEntity;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.ConsultaLimiteUtils;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class HorariosCorteRasterSqlRepository implements HorariosCorteRasterDataSource {

    private static final int TOLERANCIA_HORARIO_CORTE_MINUTOS = 10;
    private static final PeriodoOffsetDateTimeHelper PERIODO_RASTER = PeriodoOffsetDateTimeHelper.padrao();
    private static final String PARAM_TOLERANCIA_HORARIO_CORTE_MINUTOS = "toleranciaHorarioCorteMinutos";

    private static final List<String> FILIAIS_RASTER_PADRAO = List.of(
            "AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CAS - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CPQ - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CWB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "NHB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "REC - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "RJR - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "SPO - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"
    );

    // As leituras do Raster podem expandir a captura em JSON. Materializar as rotas da janela
    // uma vez evita repetir essa leitura para cada combinação de filial e horário de corte.
    private static final String BASE_CTE = """
            SET NOCOUNT ON;
            DECLARE @fusoRaster SYSNAME = N'E. South America Standard Time';
            DECLARE @rotas TABLE (
                cod_solicitacao BIGINT, status_viagem NVARCHAR(10), placa_veiculo NVARCHAR(20),
                rota_limpa NVARCHAR(500), origem_raw NVARCHAR(500), destino_raw NVARCHAR(500),
                origem_sm NVARCHAR(100), destino_sm NVARCHAR(100),
                dia_base_sm DATE, data_hora_real_ini_at DATETIME2(7),
                data_hora_real_fim_at DATETIME2(7), data_hora_prev_fim_at DATETIME2(7),
                data_extracao_at DATETIME2(3)
            );
            WITH viagens_base AS (
                SELECT
                    v.cod_solicitacao,
                    v.status_viagem,
                    v.placa_veiculo,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(v.rota_descricao, N'/BRASIL', N''), CHAR(13), N' '), CHAR(10), N' '))), N'') AS rota_limpa,
                    v.data_hora_real_ini, v.data_hora_real_fim, v.data_hora_prev_fim,
                    v.data_hora_prev_ini AS inicio_referencia,
                    v.data_extracao
                FROM dbo.raster_viagens v
                WHERE v.data_hora_prev_ini >= :dataInicio
                  AND v.data_hora_prev_ini < :dataFimExclusivo

                UNION ALL

                SELECT
                    v.cod_solicitacao,
                    v.status_viagem,
                    v.placa_veiculo,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(v.rota_descricao, N'/BRASIL', N''), CHAR(13), N' '), CHAR(10), N' '))), N'') AS rota_limpa,
                    v.data_hora_real_ini, v.data_hora_real_fim, v.data_hora_prev_fim,
                    v.data_hora_real_ini AS inicio_referencia,
                    v.data_extracao
                FROM dbo.raster_viagens v
                WHERE v.data_hora_prev_ini IS NULL
                  AND v.data_hora_real_ini >= :dataInicio
                  AND v.data_hora_real_ini < :dataFimExclusivo
            ),
            paradas AS (
                SELECT
                    p.cod_solicitacao,
                    MAX(p.data_extracao) AS parada_data_extracao
                FROM dbo.raster_viagem_paradas p
                GROUP BY p.cod_solicitacao
            ),
            viagens AS (
                SELECT
                    v.cod_solicitacao,
                    v.status_viagem,
                    v.placa_veiculo,
                    v.rota_limpa,
                    CAST(v.data_hora_real_ini AT TIME ZONE @fusoRaster AS DATETIME2(7)) AS data_hora_real_ini_at,
                    CAST(v.data_hora_real_fim AT TIME ZONE @fusoRaster AS DATETIME2(7)) AS data_hora_real_fim_at,
                    CAST(v.data_hora_prev_fim AT TIME ZONE @fusoRaster AS DATETIME2(7)) AS data_hora_prev_fim_at,
                    CAST(v.inicio_referencia AT TIME ZONE @fusoRaster AS DATE) AS dia_base_sm,
                    CASE
                        WHEN p.parada_data_extracao IS NULL THEN v.data_extracao
                        WHEN v.data_extracao IS NULL THEN p.parada_data_extracao
                        WHEN p.parada_data_extracao > v.data_extracao THEN p.parada_data_extracao
                        ELSE v.data_extracao
                    END AS data_extracao_at
                FROM viagens_base v
                LEFT HASH JOIN paradas p
                    ON p.cod_solicitacao = v.cod_solicitacao
            ),
            partes_rota AS (
                SELECT
                    v.*,
                    CHARINDEX(N' ATE ', UPPER(v.rota_limpa)) AS separador_ate
                FROM viagens v
            ),
            rota AS (
                SELECT
                    p.*,
                    NULLIF(LTRIM(RTRIM(CASE
                        WHEN p.separador_ate > 0 THEN LEFT(p.rota_limpa, p.separador_ate - 1)
                        ELSE p.rota_limpa
                    END)), N'') AS origem_raw,
                    NULLIF(LTRIM(RTRIM(CASE
                        WHEN p.separador_ate > 0 THEN SUBSTRING(p.rota_limpa, p.separador_ate + 5, 500)
                        ELSE NULL
                    END)), N'') AS destino_raw
                FROM partes_rota p
            ),
            rota_canonica AS (
                SELECT
                    r.*,
                    CASE
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%AGUDOS/SP%' THEN N'AGUDOS/SP - RODOGARCIA FILIAL AGU'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%CAMPINAS/SP%' THEN N'CAMPINAS/SP - RODOGARCIA FILIAL CPQ'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%CASTRO/PR%' THEN N'CASTRO/PR - RODOGARCIA FILIAL CAS'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%SAO JOSE DOS PINHAIS/PR%' THEN N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%OSASCO/SP%' THEN N'OSASCO/SP - RODOGARCIA FILIAL SPO'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%DUQUE DE CAXIAS/RJ%' THEN N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%JABOATAO DOS GUARARAPES/PE%' THEN N'JABOATAO DOS GUARARAPES/PE - RODOGARCIA FILIAL REC'
                        WHEN UPPER(r.origem_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.origem_raw) LIKE N'%NOVO HAMBURGO/RS%' THEN N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB'
                        ELSE NULL
                    END AS origem_sm,
                    CASE
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%AGUDOS/SP%' THEN N'AGUDOS/SP - RODOGARCIA FILIAL AGU'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%CAMPINAS/SP%' THEN N'CAMPINAS/SP - RODOGARCIA FILIAL CPQ'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%CASTRO/PR%' THEN N'CASTRO/PR - RODOGARCIA FILIAL CAS'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%SAO JOSE DOS PINHAIS/PR%' THEN N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%OSASCO/SP%' THEN N'OSASCO/SP - RODOGARCIA FILIAL SPO'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%DUQUE DE CAXIAS/RJ%' THEN N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%JABOATAO DOS GUARARAPES/PE%' THEN N'JABOATAO DOS GUARARAPES/PE - RODOGARCIA FILIAL REC'
                        WHEN UPPER(r.destino_raw) LIKE N'%RODOGARCIA%' AND UPPER(r.destino_raw) LIKE N'%NOVO HAMBURGO/RS%' THEN N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB'
                        ELSE NULL
                    END AS destino_sm
                FROM rota r
            )
            INSERT INTO @rotas (
                cod_solicitacao, status_viagem, placa_veiculo, rota_limpa, origem_raw, destino_raw,
                origem_sm, destino_sm, dia_base_sm, data_hora_real_ini_at,
                data_hora_real_fim_at, data_hora_prev_fim_at, data_extracao_at
            )
            SELECT cod_solicitacao, status_viagem, placa_veiculo, rota_limpa, origem_raw, destino_raw,
                   origem_sm, destino_sm, dia_base_sm, data_hora_real_ini_at,
                   data_hora_real_fim_at, data_hora_prev_fim_at, data_extracao_at
            FROM rota_canonica;

            WITH hc_apoio AS (
                SELECT *
                FROM (VALUES
                    (N'AGUDOS/SP - RODOGARCIA FILIAL AGU', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'20:30:00' AS TIME(0))),
                    (N'CAMPINAS/SP - RODOGARCIA FILIAL CPQ', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'20:30:00' AS TIME(0))),
                    (N'CASTRO/PR - RODOGARCIA FILIAL CAS', N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', CAST(N'20:00:00' AS TIME(0))),
                    (N'CASTRO/PR - RODOGARCIA FILIAL CAS', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'22:30:00' AS TIME(0))),
                    (N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB', CAST(N'22:00:00' AS TIME(0))),
                    (N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', N'CASTRO/PR - RODOGARCIA FILIAL CAS', CAST(N'01:00:00' AS TIME(0))),
                    (N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'00:30:00' AS TIME(0))),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'CASTRO/PR - RODOGARCIA FILIAL CAS', CAST(N'23:00:00' AS TIME(0))),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', CAST(N'23:30:00' AS TIME(0))),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR', CAST(N'23:30:00' AS TIME(0))),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'AGUDOS/SP - RODOGARCIA FILIAL AGU', CAST(N'02:30:00' AS TIME(0))),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'CAMPINAS/SP - RODOGARCIA FILIAL CPQ', CAST(N'04:00:00' AS TIME(0))),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'JABOATAO DOS GUARARAPES/PE - RODOGARCIA FILIAL REC', CAST(N'04:00:00' AS TIME(0))),
                    (N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'22:00:00' AS TIME(0))),
                    (N'JABOATAO DOS GUARARAPES/PE - RODOGARCIA FILIAL REC', N'OSASCO/SP - RODOGARCIA FILIAL SPO', CAST(N'22:00:00' AS TIME(0))),
                    (N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB', N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', CAST(N'04:00:00' AS TIME(0)))
                ) AS apoio(origem_sm, destino_sm, horario_corte)
            ),
            filiais_raster AS (
                SELECT *
                FROM (VALUES
                    (N'AGUDOS/SP - RODOGARCIA FILIAL AGU', N'AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'CAMPINAS/SP - RODOGARCIA FILIAL CPQ', N'CPQ - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'CASTRO/PR - RODOGARCIA FILIAL CAS', N'CAS - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'SAO JOSE DOS PINHAIS/PR - RODOGARCIA FILIAL CWB', N'CWB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'OSASCO/SP - RODOGARCIA FILIAL SPO', N'SPO - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'DUQUE DE CAXIAS/RJ - RODOGARCIA FILIAL RJR', N'RJR - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'JABOATAO DOS GUARARAPES/PE - RODOGARCIA FILIAL REC', N'REC - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'),
                    (N'NOVO HAMBURGO/RS - RODOGARCIA FILIAL NHB', N'NHB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA')
                ) AS filial(origem_sm, filial)
            ),
            calculado AS (
                SELECT
                    rc.*,
                    COALESCE(filial.filial, N'Não mapeada') AS filial,
                    LOWER(COALESCE(filial.filial, N'Não mapeada')) COLLATE Latin1_General_CI_AI AS filial_key,
                    CONCAT(rc.origem_sm, N' x ', rc.destino_sm) AS origem_destino,
                    apoio.horario_corte,
                    rc.dia_base_sm AS data_corte,
                    CASE
                        WHEN rc.dia_base_sm IS NULL OR apoio.horario_corte IS NULL THEN NULL
                        ELSE DATEADD(SECOND, DATEDIFF(SECOND, CAST(N'00:00:00' AS TIME), apoio.horario_corte), CAST(rc.dia_base_sm AS DATETIME2(0)))
                    END AS corte_at,
                    vj.cod_solicitacao AS cod_solicitacao_justificada,
                    vj.justificativa AS justificativa
                FROM @rotas rc
                LEFT JOIN hc_apoio apoio
                    ON apoio.origem_sm = rc.origem_sm
                   AND apoio.destino_sm = rc.destino_sm
                LEFT JOIN filiais_raster filial
                    ON filial.origem_sm = rc.origem_sm
                LEFT JOIN dbo.viagem_justificativas vj
                    ON rc.cod_solicitacao = vj.cod_solicitacao
                   AND vj.ativo = 1
            )
            """;

    private static final String COLUNAS_TABELA = """
                CONVERT(BIGINT, cod_solicitacao) AS id,
                data_corte AS data,
                filial,
                COALESCE(origem_destino, rota_limpa, CONCAT(N'SM ', CONVERT(NVARCHAR(30), cod_solicitacao))) AS linha_ou_operacao,
                origem_sm,
                destino_sm,
                origem_destino,
                CASE WHEN origem_sm IS NULL THEN origem_raw ELSE LEFT(origem_sm, CHARINDEX(N' - ', origem_sm + N' - ') - 1) END AS origem,
                N'1º' AS ordem,
                CASE WHEN destino_sm IS NULL THEN destino_raw ELSE LEFT(destino_sm, CHARINDEX(N' - ', destino_sm + N' - ') - 1) END AS destino,
                CASE WHEN horario_corte IS NULL THEN NULL ELSE CONVERT(CHAR(5), horario_corte, 108) END AS horario_corte_sm,
                CASE WHEN data_hora_prev_fim_at IS NULL THEN NULL ELSE CONVERT(CHAR(5), CAST(data_hora_prev_fim_at AS TIME), 108) END AS previsao_chegada_destino,
                CASE
                    WHEN data_hora_real_ini_at IS NULL OR COALESCE(data_hora_real_fim_at, data_hora_prev_fim_at) IS NULL THEN NULL
                    WHEN DATEDIFF(MINUTE, data_hora_real_ini_at, COALESCE(data_hora_real_fim_at, data_hora_prev_fim_at)) < 0 THEN NULL
                    ELSE CONCAT(
                        CASE
                            WHEN DATEDIFF(MINUTE, data_hora_real_ini_at, COALESCE(data_hora_real_fim_at, data_hora_prev_fim_at)) / 60 < 100
                                THEN RIGHT(N'00' + CONVERT(NVARCHAR(2), DATEDIFF(MINUTE, data_hora_real_ini_at, COALESCE(data_hora_real_fim_at, data_hora_prev_fim_at)) / 60), 2)
                            ELSE CONVERT(NVARCHAR(10), DATEDIFF(MINUTE, data_hora_real_ini_at, COALESCE(data_hora_real_fim_at, data_hora_prev_fim_at)) / 60)
                        END,
                        N':',
                        RIGHT(N'00' + CONVERT(NVARCHAR(2), DATEDIFF(MINUTE, data_hora_real_ini_at, COALESCE(data_hora_real_fim_at, data_hora_prev_fim_at)) % 60), 2)
                    )
                END AS transit_time,
                CAST(data_hora_real_ini_at AS TIME(0)) AS inicio,
                CAST(NULL AS TIME(0)) AS manifestado,
                CAST(data_base_sm_at AS TIME(0)) AS sm_gerada,
                CAST(corte_at AS TIME(0)) AS corte,
                data_hora_real_ini_at AS saida_efetiva,
                corte_at AS horario_corte,
                CASE
                    WHEN cod_solicitacao_justificada IS NOT NULL THEN CAST(1 AS BIT)
                    WHEN data_hora_real_ini_at IS NULL OR corte_at IS NULL THEN NULL
                    WHEN data_hora_real_ini_at <= DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at) THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS saiu_no_horario,
                CASE
                    WHEN cod_solicitacao_justificada IS NOT NULL THEN 0
                    WHEN data_hora_real_ini_at IS NULL OR corte_at IS NULL THEN NULL
                    WHEN data_hora_real_ini_at <= DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at) THEN 0
                    ELSE DATEDIFF(MINUTE, DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at), data_hora_real_ini_at)
                END AS atraso_minutos,
                justificativa AS justificativa,
                CONCAT(
                    N'Raster API | SM ',
                    CONVERT(NVARCHAR(30), cod_solicitacao),
                    N' | Placa ',
                    COALESCE(placa_veiculo, N''),
                    N' | Status ',
                    COALESCE(status_viagem, N''),
                    CASE WHEN horario_corte IS NULL THEN N' | Sem horario de corte em HC Apoio' ELSE N'' END
                ) AS observacao,
                N'Raster API - SQL Server' AS nome_arquivo,
                data_extracao_at AS importado_em,
                N'dbo.raster_viagens' AS importado_por,
                data_extracao_at AS data_extracao
            FROM calculado
            """;

    private static final String SQL = BASE_CTE + "SELECT " + COLUNAS_TABELA;
    private static final String SQL_PAGINA = BASE_CTE + "SELECT COUNT_BIG(*) OVER () AS total_filtrado, " + COLUNAS_TABELA;

    private static final String SQL_INDICADOR_CTE = BASE_CTE + """
            , indicador AS (
                SELECT
                    data_corte,
                    filial,
                    filial_key,
                    data_extracao_at,
                    N'Raster API - SQL Server' AS nome_arquivo,
                    CASE
                        WHEN cod_solicitacao_justificada IS NOT NULL THEN 1
                        WHEN data_hora_real_ini_at <= DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at) THEN 1
                        ELSE 0
                    END AS saiu_no_horario
                FROM calculado
                WHERE data_corte IS NOT NULL
                  AND data_hora_real_ini_at IS NOT NULL
                  AND corte_at IS NOT NULL
                  AND (:escopoFiliaisVazio = 1 OR filial_key IN (:escopoFiliais))
                  AND (:filiaisVazio = 1 OR filial_key IN (:filiais))
            )
            """;

    private static final String SQL_OVERVIEW = SQL_INDICADOR_CTE + """
            SELECT
                CONVERT(NVARCHAR(30), MAX(data_extracao_at), 126) AS updated_at,
                COUNT_BIG(1) AS total_programado,
                COALESCE(SUM(CASE WHEN saiu_no_horario = 1 THEN 1 ELSE 0 END), 0) AS saidas_no_horario,
                COALESCE(SUM(CASE WHEN saiu_no_horario = 0 THEN 1 ELSE 0 END), 0) AS saidas_fora_horario,
                CONVERT(NVARCHAR(30), MAX(data_extracao_at), 126) AS ultima_importacao_em,
                MAX(CASE WHEN data_extracao_at IS NOT NULL THEN nome_arquivo END) AS ultima_importacao_arquivo
            FROM indicador
            """;

    private static final String SQL_SERIE = SQL_INDICADOR_CTE + """
            SELECT
                CONVERT(CHAR(10), data_corte, 23) AS date,
                filial,
                COUNT_BIG(1) AS total_programado,
                COALESCE(SUM(CASE WHEN saiu_no_horario = 1 THEN 1 ELSE 0 END), 0) AS saidas_no_horario,
                COALESCE(SUM(CASE WHEN saiu_no_horario = 0 THEN 1 ELSE 0 END), 0) AS saidas_fora_horario
            FROM indicador
            GROUP BY data_corte, filial
            ORDER BY data_corte, filial
            """;

    private static final String SQL_COUNT = BASE_CTE + "SELECT COUNT_BIG(1) FROM calculado";
    private static final String SQL_ORDER_PAGED = """
            ORDER BY data DESC, importado_em DESC, filial, linha_ou_operacao, id
            OFFSET :offset ROWS FETCH NEXT :limite ROWS ONLY
            """;
    private static final String LINHA_OU_OPERACAO_SQL = "COALESCE(origem_destino, rota_limpa, CONCAT(N'SM ', CONVERT(NVARCHAR(30), cod_solicitacao)))";
    private static final String STATUS_TABELA_SQL = """
            (CASE
                WHEN cod_solicitacao_justificada IS NOT NULL THEN N'no prazo'
                WHEN data_hora_real_ini_at IS NULL OR corte_at IS NULL THEN N'sem dado'
                WHEN data_hora_real_ini_at <= DATEADD(MINUTE, :toleranciaHorarioCorteMinutos, corte_at) THEN N'no prazo'
                ELSE N'fora do prazo'
            END)
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public HorariosCorteRasterSqlRepository(@ConsultaAnalitica JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    @Override
    public HorariosCorteResumo buscarResumoPorPeriodo(
            LocalDate dataInicio,
            LocalDate dataFim,
            EscopoFilialService.EscopoFilial escopo,
            List<String> filiaisFiltro
    ) {
        Map<String, Object> row = jdbcTemplate.queryForMap(
                SQL_OVERVIEW,
                paramsPeriodo(dataInicio, dataFim, escopo, filiaisFiltro)
        );

        return new HorariosCorteResumo(
                texto(row, "updated_at"),
                longo(row, "total_programado"),
                longo(row, "saidas_no_horario"),
                longo(row, "saidas_fora_horario"),
                texto(row, "ultima_importacao_em"),
                texto(row, "ultima_importacao_arquivo")
        );
    }

    @Override
    public List<HorariosCorteSeriePointDTO> buscarSeriePorPeriodo(
            LocalDate dataInicio,
            LocalDate dataFim,
            EscopoFilialService.EscopoFilial escopo,
            List<String> filiaisFiltro
    ) {
        return jdbcTemplate.query(
                SQL_SERIE,
                paramsPeriodo(dataInicio, dataFim, escopo, filiaisFiltro),
                (rs, rowNum) -> {
                    long total = rs.getLong("total_programado");
                    long noHorario = rs.getLong("saidas_no_horario");
                    return new HorariosCorteSeriePointDTO(
                            rs.getString("date"),
                            rs.getString("filial"),
                            inteiro(noHorario),
                            inteiro(total),
                            percentual(noHorario, total)
                    );
                }
        );
    }

    @Override
    public List<VisaoHorariosCorteEntity> findByDataBetween(
            LocalDate dataInicio,
            LocalDate dataFim,
            EscopoFilialService.EscopoFilial escopo,
            List<String> filiaisFiltro,
            FiltroConsultaDTO filtro
    ) {
        TabelaQuery query = tabelaQuery(SQL, dataInicio, dataFim, escopo, filiaisFiltro, filtro, "");
        return jdbcTemplate.query(
                query.sql(),
                query.params(),
                this::mapRow
        );
    }

    @Override
    public PaginaDTO<VisaoHorariosCorteEntity> findPageByDataBetween(
            LocalDate dataInicio,
            LocalDate dataFim,
            EscopoFilialService.EscopoFilial escopo,
            List<String> filiaisFiltro,
            FiltroConsultaDTO filtro,
            int paginaSolicitada,
            int tamanhoSolicitado
    ) {
        int pagina = Math.max(1, paginaSolicitada);
        int tamanho = ConsultaLimiteUtils.limitar(tamanhoSolicitado, 10, 100);
        long offset = (long) (pagina - 1) * tamanho;
        TabelaQuery pageQuery = tabelaQuery(SQL_PAGINA, dataInicio, dataFim, escopo, filiaisFiltro, filtro, SQL_ORDER_PAGED);
        pageQuery.params()
                .addValue("offset", offset)
                .addValue("limite", tamanho);
        List<LinhaComTotal> linhas = jdbcTemplate.query(pageQuery.sql(), pageQuery.params(),
                (rs, posicao) -> new LinhaComTotal(mapRow(rs, posicao), rs.getLong("total_filtrado")));
        long totalElementos = linhas.isEmpty() ? 0 : linhas.get(0).total();
        if (linhas.isEmpty() && pagina > 1) {
            // Uma página além do fim ainda precisa informar quantos registros atenderam ao filtro.
            TabelaQuery countQuery = tabelaQuery(SQL_COUNT, dataInicio, dataFim, escopo, filiaisFiltro, filtro, "");
            Long total = jdbcTemplate.queryForObject(countQuery.sql(), countQuery.params(), Long.class);
            totalElementos = total == null ? 0 : total;
        }
        int totalPaginas = (int) Math.ceil(totalElementos / (double) tamanho);
        List<VisaoHorariosCorteEntity> conteudo = linhas.stream().map(LinhaComTotal::linha).toList();
        return new PaginaDTO<>(conteudo, totalElementos, totalPaginas, pagina, tamanho);
    }

    private record LinhaComTotal(VisaoHorariosCorteEntity linha, long total) {}

    private TabelaQuery tabelaQuery(
            String sqlBase,
            LocalDate dataInicio,
            LocalDate dataFim,
            EscopoFilialService.EscopoFilial escopo,
            List<String> filiaisFiltro,
            FiltroConsultaDTO filtro,
            String sufixo
    ) {
        FiltroConsultaDTO filtroEfetivo = filtro != null ? filtro : new FiltroConsultaDTO(dataInicio, dataFim, Map.of());
        MapSqlParameterSource params = paramsPeriodo(dataInicio, dataFim, escopo, filiaisFiltro);
        StringBuilder sql = new StringBuilder(sqlBase)
                .append("\nWHERE (:escopoFiliaisVazio = 1 OR filial_key IN (:escopoFiliais))")
                .append("\n  AND (:filiaisVazio = 1 OR filial_key IN (:filiais))");

        adicionarFiltrosTabela(sql, params, filtroEfetivo);
        if (sufixo != null && !sufixo.isBlank()) {
            sql.append('\n').append(sufixo);
        }

        return new TabelaQuery(sql.toString(), params);
    }

    private static void adicionarFiltrosTabela(StringBuilder where, MapSqlParameterSource params, FiltroConsultaDTO filtro) {
        adicionarFiltroBuscaTabela(where, params, filtro.valores("tabelaBusca"));
        adicionarFiltroStatusTabela(where, params, "filtroTabelaStatus", filtro.valores("tabelaStatus"));

        for (Map.Entry<String, List<String>> entry : filtro.filtros().entrySet()) {
            String chave = entry.getKey();
            if (!chave.startsWith("tabelaColuna.")) {
                continue;
            }

            String coluna = chave.substring("tabelaColuna.".length());
            adicionarFiltroColunaTabela(where, params, coluna, entry.getValue());
        }
    }

    private static void adicionarFiltroBuscaTabela(
            StringBuilder where,
            MapSqlParameterSource params,
            Collection<String> valores
    ) {
        String termo = primeiroNormalizado(valores);
        if (termo == null || termo.length() < 3) {
            return;
        }

        params.addValue("filtroTabelaBusca", "%" + termo + "%");
        where.append("\n  AND (")
                .append("filial_key LIKE :filtroTabelaBusca")
                .append(" OR ").append(normalizarSql(LINHA_OU_OPERACAO_SQL)).append(" LIKE :filtroTabelaBusca")
                .append(" OR ").append(normalizarSql("origem_sm")).append(" LIKE :filtroTabelaBusca")
                .append(" OR ").append(normalizarSql("destino_sm")).append(" LIKE :filtroTabelaBusca")
                .append(" OR ").append(normalizarSql("origem_raw")).append(" LIKE :filtroTabelaBusca")
                .append(" OR ").append(normalizarSql("destino_raw")).append(" LIKE :filtroTabelaBusca")
                .append(" OR CONVERT(NVARCHAR(30), cod_solicitacao) LIKE :filtroTabelaBusca")
                .append(" OR ").append(STATUS_TABELA_SQL).append(" LIKE :filtroTabelaBusca")
                .append(")");
    }

    private static void adicionarFiltroColunaTabela(
            StringBuilder where,
            MapSqlParameterSource params,
            String coluna,
            Collection<String> valores
    ) {
        String param = "filtroTabelaColuna_" + coluna.replaceAll("[^A-Za-z0-9]", "_");
        switch (coluna) {
            case "filial" -> adicionarFiltroTextoNormalizado(where, params, "filial_key", valores, param);
            case "linhaOuOperacao", "linhaOperacao" -> adicionarFiltroTextoColuna(where, params, LINHA_OU_OPERACAO_SQL, valores, param);
            case "status", "saiuNoHorario" -> adicionarFiltroStatusTabela(where, params, param, valores);
            default -> {
            }
        }
    }

    private static void adicionarFiltroTextoNormalizado(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        String termo = primeiroNormalizado(valores);
        if (termo == null) {
            return;
        }

        params.addValue(param, "%" + termo + "%");
        where.append("\n  AND ").append(expressao).append(" LIKE :").append(param);
    }

    private static void adicionarFiltroTextoColuna(
            StringBuilder where,
            MapSqlParameterSource params,
            String expressao,
            Collection<String> valores,
            String param
    ) {
        String termo = primeiroNormalizado(valores);
        if (termo == null) {
            return;
        }

        params.addValue(param, "%" + termo + "%");
        where.append("\n  AND ").append(normalizarSql(expressao)).append(" LIKE :").append(param);
    }

    private static void adicionarFiltroStatusTabela(
            StringBuilder where,
            MapSqlParameterSource params,
            String param,
            Collection<String> valores
    ) {
        List<String> normalizados = normalizarStatus(valores);
        if (normalizados.isEmpty()) {
            return;
        }

        params.addValue(param, normalizados);
        where.append("\n  AND ").append(STATUS_TABELA_SQL).append(" IN (:").append(param).append(")");
    }

    private static List<String> normalizarStatus(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }

        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(HorariosCorteRasterSqlRepository::normalizarStatusValor)
                .distinct()
                .toList();
    }

    private static String normalizarStatusValor(String valor) {
        String texto = valor.trim().toLowerCase(Locale.ROOT);
        return switch (texto) {
            case "true", "sim", "no prazo", "no horario", "no horário", "pontual" -> "no prazo";
            case "false", "fora do prazo", "fora horario", "fora do horario", "fora do horário", "atrasado" -> "fora do prazo";
            case "sem dado", "sem dados", "sem status", "null" -> "sem dado";
            default -> texto;
        };
    }

    private static String primeiroNormalizado(Collection<String> valores) {
        if (valores == null) {
            return null;
        }

        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .findFirst()
                .orElse(null);
    }

    private static String normalizarSql(String expressao) {
        return "LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(4000), " + expressao + ")))) COLLATE Latin1_General_CI_AI";
    }

    private MapSqlParameterSource paramsPeriodo(
            LocalDate dataInicio,
            LocalDate dataFim,
            EscopoFilialService.EscopoFilial escopo,
            List<String> filiaisFiltro
    ) {
        List<String> escopoFiliais = normalizarFiliais(escopo.filiaisOrdenadas());
        List<String> filiais = normalizarFiliais(filiaisFiltro);

        if (escopoFiliais.isEmpty()) {
            escopoFiliais = List.of("__sem_acesso__");
        }
        if (filiais.isEmpty()) {
            filiais = List.of("__sem_filtro__");
        }

        var janela = PERIODO_RASTER.criarJanela(dataInicio, dataFim);
        return new MapSqlParameterSource()
                .addValue("dataInicio", janela.inicioInclusivo())
                .addValue("dataFimExclusivo", janela.fimExclusivo())
                .addValue(PARAM_TOLERANCIA_HORARIO_CORTE_MINUTOS, TOLERANCIA_HORARIO_CORTE_MINUTOS)
                .addValue("escopoFiliais", escopoFiliais)
                .addValue("escopoFiliaisVazio", escopo.acessoTotal() ? 1 : 0)
                .addValue("filiais", filiais)
                .addValue("filiaisVazio", filiaisFiltro == null || filiaisFiltro.isEmpty() ? 1 : 0);
    }

    private static List<String> normalizarFiliais(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(HorariosCorteRasterSqlRepository::canonicalizarFilial)
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private static String canonicalizarFilial(String filial) {
        if (filial == null || filial.isBlank()) {
            return filial;
        }

        String valor = filial.trim();
        String normalizado = valor.toLowerCase(Locale.ROOT);
        for (String canonica : FILIAIS_RASTER_PADRAO) {
            String codigo = canonica.substring(0, canonica.indexOf(" - "));
            String codigoLower = codigo.toLowerCase(Locale.ROOT);
            if (normalizado.equals(codigoLower)
                    || normalizado.equals(canonica.toLowerCase(Locale.ROOT))
                    || normalizado.equals("tr rodogarcia | " + codigoLower)
                    || normalizado.equals("rodogarcia filial " + codigoLower)) {
                return canonica;
            }
        }
        return valor;
    }

    private static String texto(Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        return valor == null ? null : String.valueOf(valor);
    }

    private static long longo(Map<String, Object> row, String chave) {
        Object valor = row.get(chave);
        return valor instanceof Number number ? number.longValue() : 0L;
    }

    private static int inteiro(long valor) {
        if (valor > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        if (valor < Integer.MIN_VALUE) {
            return Integer.MIN_VALUE;
        }
        return (int) valor;
    }

    private static double percentual(long numerador, long denominador) {
        if (denominador <= 0) {
            return 0.0;
        }
        return BigDecimal.valueOf((numerador * 100.0) / denominador)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private VisaoHorariosCorteEntity mapRow(ResultSet rs, int rowNum) throws SQLException {
        return VisaoHorariosCorteEntity.fromJdbc(
                rs.getLong("id"),
                localDate(rs, "data"),
                rs.getString("filial"),
                rs.getString("linha_ou_operacao"),
                rs.getString("origem_sm"),
                rs.getString("destino_sm"),
                rs.getString("origem_destino"),
                rs.getString("origem"),
                rs.getString("ordem"),
                rs.getString("destino"),
                rs.getString("horario_corte_sm"),
                rs.getString("previsao_chegada_destino"),
                rs.getString("transit_time"),
                localTime(rs, "inicio"),
                localTime(rs, "manifestado"),
                localTime(rs, "sm_gerada"),
                localTime(rs, "corte"),
                localDateTime(rs, "saida_efetiva"),
                localDateTime(rs, "horario_corte"),
                nullableBoolean(rs, "saiu_no_horario"),
                nullableInteger(rs, "atraso_minutos"),
                rs.getString("justificativa"),
                rs.getString("observacao"),
                rs.getString("nome_arquivo"),
                localDateTime(rs, "importado_em"),
                rs.getString("importado_por"),
                localDateTime(rs, "data_extracao")
        );
    }

    private LocalDate localDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date value = rs.getDate(column);
        return value != null ? value.toLocalDate() : null;
    }

    private LocalDateTime localDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value != null ? value.toLocalDateTime() : null;
    }

    private LocalTime localTime(ResultSet rs, String column) throws SQLException {
        Time value = rs.getTime(column);
        return value != null ? value.toLocalTime() : null;
    }

    private Boolean nullableBoolean(ResultSet rs, String column) throws SQLException {
        boolean value = rs.getBoolean(column);
        return rs.wasNull() ? null : value;
    }

    private Integer nullableInteger(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private record TabelaQuery(String sql, MapSqlParameterSource params) {
    }
}
