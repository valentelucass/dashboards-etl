package com.dashboard.api.service;

import com.dashboard.api.dto.fretes.FretesGoalBranchSummaryDTO;
import com.dashboard.api.dto.fretes.FretesGoalConfigDTO;
import com.dashboard.api.dto.fretes.FretesGoalConfigRequestDTO;
import com.dashboard.api.dto.fretes.FretesGoalSummaryDTO;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.format.DateTimeFormatter;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Order(7)
public class FretesGoalService implements ApplicationRunner {

    public static final String GLOBAL_BRANCH_ID = "GLOBAL";
    private static final Logger log = LoggerFactory.getLogger(FretesGoalService.class);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final UsuarioRepository usuarioRepository;

    public FretesGoalService(NamedParameterJdbcTemplate jdbcTemplate, UsuarioRepository usuarioRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        validarSchema();
    }

    @Transactional(readOnly = true)
    public FretesGoalSummaryDTO buscarResumo(
            LocalDate dataInicio,
            LocalDate dataFim,
            Collection<FretesBranchRealizado> realizados,
            Collection<String> filiaisSelecionadas
    ) {
        Set<String> filiaisFiltradas = new LinkedHashSet<>();
        filiaisSelecionadas.stream()
                .map(this::normalizarBranchId)
                .filter(Objects::nonNull)
                .forEach(filiaisFiltradas::add);

        Set<String> branchIds = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        branchIds.addAll(filiaisFiltradas);
        realizados.stream()
                .map(FretesBranchRealizado::branchId)
                .map(this::normalizarBranchId)
                .filter(Objects::nonNull)
                .forEach(branchIds::add);

        Map<String, FretesBranchRealizado> realizadoPorFilial = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        for (FretesBranchRealizado realizado : realizados) {
            String branchId = normalizarBranchId(realizado.branchId());
            if (branchId != null) {
                realizadoPorFilial.put(branchId, realizado);
            }
        }

        GoalPeriodResult metasPeriodo = tabelaMetasExiste()
                ? calcularMetasPeriodo(dataInicio, dataFim, branchIds, !filiaisFiltradas.isEmpty())
                : GoalPeriodResult.zero(branchIds);
        branchIds.addAll(metasPeriodo.branchIds());

        Map<String, GoalTotals> metasPorFilial = metasPeriodo.metasPorFilial();
        List<FretesGoalBranchSummaryDTO> branches = branchIds.stream()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .map(branchId -> {
                    GoalTotals meta = metasPorFilial.getOrDefault(branchId, GoalTotals.zero());
                    FretesBranchRealizado realizado = realizadoPorFilial.getOrDefault(
                            branchId,
                            new FretesBranchRealizado(branchId, BigDecimal.ZERO)
                    );
                    return toBranchSummary(branchId, meta, realizado);
                })
                .toList();

        BigDecimal metaFaturamento = metasPeriodo.aggregate().metaFaturamento()
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal realizadoFaturamento = branches.stream()
                .map(FretesGoalBranchSummaryDTO::realizadoFaturamento)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        return new FretesGoalSummaryDTO(
                dataInicio.format(DATE_FMT),
                dataFim.format(DATE_FMT),
                metaFaturamento,
                realizadoFaturamento,
                percentual(realizadoFaturamento, metaFaturamento),
                branches
        );
    }

    public List<FretesGoalConfigDTO> buscarConfiguracoes(int ano, int mes) {
        validarAnoMes(ano, mes);

        try {
            if (!tabelaMetasExiste()) {
                return metaConfiguracaoFallback(ano, mes, "Meta não cadastrada");
            }

            String sql = """
                    SELECT g.branch_id, g.ano, g.mes, g.meta_faturamento,
                           g.updated_at, u.nome AS updated_by_name
                    FROM acesso.fretes_goals g
                    LEFT JOIN acesso.usuarios u ON u.id = g.updated_by_user_id
                    WHERE g.ano = :ano AND g.mes = :mes
                    ORDER BY CASE WHEN g.branch_id IS NULL THEN 0 ELSE 1 END, g.branch_id
                    """;

            List<FretesGoalConfigDTO> rows = jdbcTemplate.query(sql, new MapSqlParameterSource()
                    .addValue("ano", ano)
                    .addValue("mes", mes), this::mapConfig);

            return rows.isEmpty()
                    ? metaConfiguracaoFallback(ano, mes, "Meta não cadastrada")
                    : rows;
        } catch (DataAccessException ex) {
            log.warn("Metas de fretes indisponíveis para {}/{}. Retornando fallback sem meta configurada. Motivo: {}", mes, ano, ex.getMessage());
            return metaConfiguracaoFallback(ano, mes, "Metas indisponíveis (API offline)");
        }
    }

    @Transactional
    public FretesGoalConfigDTO salvarConfiguracao(FretesGoalConfigRequestDTO request, String usuarioEmail) {
        validarSchema();
        Objects.requireNonNull(request, "request é obrigatório.");
        validarAnoMes(request.ano(), request.mes());
        BigDecimal metaFaturamento = normalizarMetaFaturamento(request.metaFaturamento());
        String branchId = normalizarBranchId(request.branchId());
        UsuarioEntity usuario = usuarioAutenticado(usuarioEmail);

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("branchId", branchId)
                .addValue("ano", request.ano())
                .addValue("mes", request.mes())
                .addValue("metaFaturamento", metaFaturamento)
                .addValue("updatedByUserId", usuario.getId());

        jdbcTemplate.update("""
                MERGE acesso.fretes_goals AS target
                USING (SELECT :branchId AS branch_id, :ano AS ano, :mes AS mes) AS source
                   ON ((target.branch_id = source.branch_id) OR (target.branch_id IS NULL AND source.branch_id IS NULL))
                  AND target.ano = source.ano
                  AND target.mes = source.mes
                WHEN MATCHED THEN
                    UPDATE SET meta_faturamento = :metaFaturamento,
                               updated_by_user_id = :updatedByUserId,
                               updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (branch_id, ano, mes, meta_faturamento, updated_by_user_id)
                    VALUES (:branchId, :ano, :mes, :metaFaturamento, :updatedByUserId);
                """, params);

        return buscarConfiguracao(branchId, request.ano(), request.mes())
                .orElseThrow(() -> new IllegalStateException("Meta salva, mas não localizada para retorno."));
    }

    @Transactional
    public List<FretesGoalConfigDTO> replicarConfiguracoesMesAnterior(int anoDestino, int mesDestino, String usuarioEmail) {
        validarSchema();
        validarAnoMes(anoDestino, mesDestino);

        YearMonth destino = YearMonth.of(anoDestino, mesDestino);
        YearMonth origem = destino.minusMonths(1);
        int totalDestino = contarConfiguracoes(destino.getYear(), destino.getMonthValue());
        if (totalDestino > 0) {
            throw new IllegalStateException(
                    "Já existem metas cadastradas para " + formatarCompetencia(destino) + "."
            );
        }

        int totalOrigem = contarConfiguracoes(origem.getYear(), origem.getMonthValue());
        if (totalOrigem == 0) {
            throw new IllegalArgumentException(
                    "Não há metas cadastradas em " + formatarCompetencia(origem) + " para copiar."
            );
        }

        UsuarioEntity usuario = usuarioAutenticado(usuarioEmail);
        int inseridas = jdbcTemplate.update("""
                INSERT INTO acesso.fretes_goals (
                    branch_id,
                    ano,
                    mes,
                    meta_faturamento,
                    meta_fretes,
                    updated_by_user_id
                )
                SELECT
                    branch_id,
                    :anoDestino,
                    :mesDestino,
                    meta_faturamento,
                    meta_fretes,
                    :updatedByUserId
                FROM acesso.fretes_goals
                WHERE ano = :anoOrigem
                  AND mes = :mesOrigem
                """, new MapSqlParameterSource()
                .addValue("anoDestino", destino.getYear())
                .addValue("mesDestino", destino.getMonthValue())
                .addValue("anoOrigem", origem.getYear())
                .addValue("mesOrigem", origem.getMonthValue())
                .addValue("updatedByUserId", usuario.getId()));

        if (inseridas != totalOrigem) {
            throw new IllegalStateException("A replicação das metas não copiou todas as linhas esperadas.");
        }

        return buscarConfiguracoes(destino.getYear(), destino.getMonthValue());
    }

    @Transactional
    public void removerConfiguracao(String branchId, int ano, int mes) {
        validarSchema();
        validarAnoMes(ano, mes);
        String normalizedBranchId = normalizarBranchId(branchId);
        jdbcTemplate.update("""
                DELETE FROM acesso.fretes_goals
                WHERE ano = :ano
                  AND mes = :mes
                  AND ((branch_id = :branchId) OR (branch_id IS NULL AND :branchId IS NULL))
                """, new MapSqlParameterSource()
                .addValue("branchId", normalizedBranchId)
                .addValue("ano", ano)
                .addValue("mes", mes));
    }

    @Transactional(readOnly = true)
    public void validarSchema() {
        exigir(tabelaMetasExiste(), "Tabela 'acesso.fretes_goals' não encontrada. Execute a migration V017.");
        exigir(colunaExiste("acesso.fretes_goals", "id"), "Coluna 'acesso.fretes_goals.id' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "branch_id"), "Coluna 'acesso.fretes_goals.branch_id' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "ano"), "Coluna 'acesso.fretes_goals.ano' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "mes"), "Coluna 'acesso.fretes_goals.mes' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "meta_faturamento"), "Coluna 'acesso.fretes_goals.meta_faturamento' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "created_at"), "Coluna 'acesso.fretes_goals.created_at' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "updated_at"), "Coluna 'acesso.fretes_goals.updated_at' não encontrada.");
        exigir(colunaExiste("acesso.fretes_goals", "updated_by_user_id"), "Coluna 'acesso.fretes_goals.updated_by_user_id' não encontrada.");
        exigir(checkConstraintExiste("acesso.fretes_goals", "CK_fretes_goals_mes"), "Constraint 'CK_fretes_goals_mes' não encontrada.");
        exigir(checkConstraintExiste("acesso.fretes_goals", "CK_fretes_goals_meta_faturamento"), "Constraint 'CK_fretes_goals_meta_faturamento' não encontrada.");
        exigir(indiceFiltradoExiste(
                        "UX_fretes_goals_branch_period",
                        "(BRANCH_IDISNOTNULL)",
                        List.of("branch_id", "ano", "mes")
                ),
                "Índice 'UX_fretes_goals_branch_period' deve ser único em (branch_id, ano, mes) com filtro branch_id IS NOT NULL."
        );
        exigir(indiceFiltradoExiste(
                        "UX_fretes_goals_global_period",
                        "(BRANCH_IDISNULL)",
                        List.of("ano", "mes")
                ),
                "Índice 'UX_fretes_goals_global_period' deve ser único em (ano, mes) com filtro branch_id IS NULL."
        );
        log.info("Schema de metas de fretes validado.");
    }

    private GoalPeriodResult calcularMetasPeriodo(LocalDate dataInicio, LocalDate dataFim, Set<String> branchIdsBase, boolean filtroFilialAtivo) {
        List<YearMonthSlice> slices = monthSlices(dataInicio, dataFim);
        Set<Integer> anos = slices.stream().map(YearMonthSlice::ano).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        List<Integer> meses = slices.stream().map(YearMonthSlice::mes).distinct().toList();

        String sql = """
                SELECT branch_id, ano, mes, meta_faturamento
                FROM acesso.fretes_goals
                WHERE ano IN (:anos)
                  AND mes IN (:meses)
                """;

        Map<GoalKey, GoalTotals> goals = jdbcTemplate.query(sql, new MapSqlParameterSource()
                        .addValue("anos", anos)
                        .addValue("meses", meses),
                (rs, rowNum) -> Map.entry(
                        new GoalKey(rs.getString("branch_id"), rs.getInt("ano"), rs.getInt("mes")),
                        new GoalTotals(rs.getBigDecimal("meta_faturamento"))
                ))
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (left, right) -> right,
                        LinkedHashMap::new
                ));

        Set<String> branchIds = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        branchIds.addAll(branchIdsBase);
        Set<String> filiaisComMetaEspecifica = goals.keySet().stream()
                .map(GoalKey::branchId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (!filtroFilialAtivo) {
            branchIds.addAll(filiaisComMetaEspecifica);
        }

        Map<String, GoalTotals> result = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        branchIds.forEach(branchId -> result.put(branchId, GoalTotals.zero()));

        for (String branchId : branchIds) {
            GoalTotals total = GoalTotals.zero();
            for (YearMonthSlice slice : slices) {
                GoalTotals monthly = goals.getOrDefault(new GoalKey(branchId, slice.ano(), slice.mes()), GoalTotals.zero());
                total = total.add(monthly);
            }
            result.put(branchId, total);
        }

        GoalTotals aggregate = GoalTotals.zero();
        for (YearMonthSlice slice : slices) {
            GoalTotals global = goals.get(new GoalKey(null, slice.ano(), slice.mes()));
            if (!filtroFilialAtivo && global != null) {
                aggregate = aggregate.add(global);
                continue;
            }

            GoalTotals subtotalFiliais = GoalTotals.zero();
            for (String branchId : branchIds) {
                subtotalFiliais = subtotalFiliais.add(goals
                        .getOrDefault(new GoalKey(branchId, slice.ano(), slice.mes()), GoalTotals.zero()));
            }
            aggregate = aggregate.add(subtotalFiliais);
        }

        return new GoalPeriodResult(result, aggregate, branchIds);
    }

    private boolean tabelaMetasExiste() {
        Integer exists = jdbcTemplate.getJdbcTemplate().queryForObject("""
                SELECT CASE WHEN OBJECT_ID(N'acesso.fretes_goals', N'U') IS NULL THEN 0 ELSE 1 END
                """, Integer.class);
        return exists != null && exists == 1;
    }

    private boolean colunaExiste(String nomeCompletoTabela, String nomeColuna) {
        Integer total = jdbcTemplate.getJdbcTemplate().queryForObject(
                "SELECT COUNT(1) WHERE COL_LENGTH(?, ?) IS NOT NULL",
                Integer.class,
                nomeCompletoTabela,
                nomeColuna
        );
        return total != null && total > 0;
    }

    private boolean checkConstraintExiste(String nomeCompletoTabela, String nomeConstraint) {
        Integer total = jdbcTemplate.getJdbcTemplate().queryForObject(
                """
                SELECT COUNT(1)
                FROM sys.check_constraints
                WHERE name = ?
                  AND parent_object_id = OBJECT_ID(?, 'U')
                """,
                Integer.class,
                nomeConstraint,
                nomeCompletoTabela
        );
        return total != null && total > 0;
    }

    private boolean indiceFiltradoExiste(String nomeIndice, String filtroNormalizadoEsperado, List<String> colunasEsperadas) {
        Integer total = jdbcTemplate.getJdbcTemplate().queryForObject(
                """
                SELECT COUNT(1)
                FROM sys.indexes i
                WHERE i.name = ?
                  AND i.object_id = OBJECT_ID(N'acesso.fretes_goals', N'U')
                  AND i.is_unique = 1
                  AND REPLACE(REPLACE(REPLACE(UPPER(ISNULL(i.filter_definition, N'')), N'[', N''), N']', N''), N' ', N'') = ?
                """,
                Integer.class,
                nomeIndice,
                filtroNormalizadoEsperado
        );
        if (total == null || total == 0) {
            return false;
        }

        List<String> colunas = jdbcTemplate.getJdbcTemplate().query(
                """
                SELECT c.name
                FROM sys.indexes i
                INNER JOIN sys.index_columns ic
                    ON ic.object_id = i.object_id
                   AND ic.index_id = i.index_id
                INNER JOIN sys.columns c
                    ON c.object_id = ic.object_id
                   AND c.column_id = ic.column_id
                WHERE i.name = ?
                  AND i.object_id = OBJECT_ID(N'acesso.fretes_goals', N'U')
                  AND ic.key_ordinal > 0
                  AND ic.is_included_column = 0
                ORDER BY ic.key_ordinal
                """,
                (rs, rowNum) -> rs.getString("name"),
                nomeIndice
        );
        return colunas.equals(colunasEsperadas);
    }

    private void exigir(boolean condicao, String mensagem) {
        if (!condicao) {
            throw new IllegalStateException(mensagem);
        }
    }

    private List<YearMonthSlice> monthSlices(LocalDate dataInicio, LocalDate dataFim) {
        List<YearMonthSlice> result = new ArrayList<>();
        LocalDate cursor = dataInicio.withDayOfMonth(1);
        LocalDate fimMes = dataFim.withDayOfMonth(1);

        while (!cursor.isAfter(fimMes)) {
            result.add(new YearMonthSlice(cursor.getYear(), cursor.getMonthValue()));
            cursor = cursor.plusMonths(1);
        }

        return result;
    }

    private FretesGoalBranchSummaryDTO toBranchSummary(String branchId, GoalTotals meta, FretesBranchRealizado realizado) {
        BigDecimal metaFaturamento = meta.metaFaturamento().setScale(2, RoundingMode.HALF_UP);
        BigDecimal realizadoFaturamento = realizado.realizadoFaturamento().setScale(2, RoundingMode.HALF_UP);
        return new FretesGoalBranchSummaryDTO(
                branchId,
                metaFaturamento,
                realizadoFaturamento,
                percentual(realizadoFaturamento, metaFaturamento)
        );
    }

    private Optional<FretesGoalConfigDTO> buscarConfiguracao(String branchId, int ano, int mes) {
        String sql = """
                SELECT g.branch_id, g.ano, g.mes, g.meta_faturamento,
                       g.updated_at, u.nome AS updated_by_name
                FROM acesso.fretes_goals g
                LEFT JOIN acesso.usuarios u ON u.id = g.updated_by_user_id
                WHERE g.ano = :ano
                  AND g.mes = :mes
                  AND ((g.branch_id = :branchId) OR (g.branch_id IS NULL AND :branchId IS NULL))
                """;
        List<FretesGoalConfigDTO> rows = jdbcTemplate.query(sql, new MapSqlParameterSource()
                .addValue("branchId", branchId)
                .addValue("ano", ano)
                .addValue("mes", mes), this::mapConfig);
        return rows.stream().findFirst();
    }

    private int contarConfiguracoes(int ano, int mes) {
        Integer total = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM acesso.fretes_goals
                WHERE ano = :ano
                  AND mes = :mes
                """, new MapSqlParameterSource()
                .addValue("ano", ano)
                .addValue("mes", mes), Integer.class);
        return total == null ? 0 : total;
    }

    private String formatarCompetencia(YearMonth competencia) {
        return String.format("%02d/%d", competencia.getMonthValue(), competencia.getYear());
    }

    private FretesGoalConfigDTO mapConfig(ResultSet rs, int rowNum) throws SQLException {
        String branchId = rs.getString("branch_id");
        java.sql.Timestamp updatedAt = rs.getTimestamp("updated_at");
        return new FretesGoalConfigDTO(
                branchId == null ? GLOBAL_BRANCH_ID : branchId,
                rs.getInt("ano"),
                rs.getInt("mes"),
                rs.getBigDecimal("meta_faturamento").setScale(2, RoundingMode.HALF_UP),
                updatedAt != null ? updatedAt.toLocalDateTime().format(DATE_TIME_FMT) : null,
                rs.getString("updated_by_name"),
                true,
                null
        );
    }

    private List<FretesGoalConfigDTO> metaConfiguracaoFallback(int ano, int mes, String mensagem) {
        return List.of(new FretesGoalConfigDTO(
                GLOBAL_BRANCH_ID,
                ano,
                mes,
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                null,
                null,
                false,
                mensagem
        ));
    }

    private String normalizarBranchId(String branchId) {
        String normalized = branchId == null || branchId.isBlank() ? GLOBAL_BRANCH_ID : branchId.trim();
        if (GLOBAL_BRANCH_ID.equalsIgnoreCase(normalized)) {
            return null;
        }
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Filial da meta excede 120 caracteres.");
        }
        return normalized;
    }

    private void validarAnoMes(int ano, int mes) {
        if (ano < 2000 || ano > 2100) {
            throw new IllegalArgumentException("Ano da meta deve estar entre 2000 e 2100.");
        }
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês da meta deve estar entre 1 e 12.");
        }
    }

    private BigDecimal normalizarMetaFaturamento(BigDecimal value) {
        BigDecimal normalized = Optional.ofNullable(value).orElse(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Meta de faturamento não pode ser negativa.");
        }
        return normalized;
    }

    private double percentual(BigDecimal realizado, BigDecimal meta) {
        if (meta == null || meta.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.doubleValue();
        }
        return realizado
                .multiply(BigDecimal.valueOf(100))
                .divide(meta, 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private UsuarioEntity usuarioAutenticado(String usuarioEmail) {
        return usuarioRepository.findByEmailIgnoreCase(Objects.toString(usuarioEmail, ""))
                .orElseThrow(() -> new IllegalArgumentException("Usuário autenticado não encontrado."));
    }

    public record FretesBranchRealizado(
            String branchId,
            BigDecimal realizadoFaturamento
    ) {
    }

    private record GoalKey(String branchId, int ano, int mes) {
        private GoalKey {
            if (branchId != null) branchId = branchId.trim().toUpperCase(Locale.ROOT);
        }
    }

    private record YearMonthSlice(int ano, int mes) {
    }

    private record GoalPeriodResult(Map<String, GoalTotals> metasPorFilial, GoalTotals aggregate, Set<String> branchIds) {
        static GoalPeriodResult zero(Set<String> branchIds) {
            Map<String, GoalTotals> result = new LinkedHashMap<>();
            branchIds.forEach(branchId -> result.put(branchId, GoalTotals.zero()));
            return new GoalPeriodResult(result, GoalTotals.zero(), new LinkedHashSet<>(branchIds));
        }
    }

    private record GoalTotals(BigDecimal metaFaturamento) {
        static GoalTotals zero() {
            return new GoalTotals(BigDecimal.ZERO);
        }

        GoalTotals add(GoalTotals other) {
            return new GoalTotals(metaFaturamento.add(other.metaFaturamento));
        }

    }
}
