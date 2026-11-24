package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.TemporalJsonUtils;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class DreReceitaRepository {
    public record Filtro(YearMonth competencia, String empresa, String filial, String centro) {}
    public record Dimensao(String empresa, String filial, String centro) {}
    public record Historico(LocalDate primeiroFrete, String atualizadoEm) {}
    public record Linha(String classe, String tipo, BigDecimal mes, BigDecimal ano) {}
    public record Resumo(Historico historico, List<Linha> valores) {}
    public record Frete(String minuta, String cte, LocalDate data, String filial, String classe, String tipo, BigDecimal valor) {}
    public record Pagina(List<Frete> itens, boolean temProxima) {}

    private static final String ORIGEM = " FROM dbo.fato_fretes_faturamento WHERE excluido_na_origem = 0";
    private static final String EMPRESA = "LEFT(NULLIF(filial_cnpj, ''), 8)";
    private static final String CLASSE = """
            CASE classificacao_nome
                WHEN N'FECHADO - FTL' THEN 'FTL'
                WHEN N'FRACIONADO - LTL' THEN 'LTL'
                WHEN N'DEDICADO/FRACIONADO - PTL' THEN 'PTL'
                ELSE 'OUTRA' END""";
    private static final String TIPO = """
            CASE tipo_frete
                WHEN 'Normal' THEN 'NORMAL'
                WHEN 'Redelivery' THEN 'REENTREGA'
                WHEN 'Return' THEN 'DEVOLUCAO'
                WHEN 'Complementary' THEN 'COMPLEMENTAR'
                WHEN 'Substitute' THEN 'SUBSTITUICAO'
                ELSE 'OUTRO' END""";
    private static final int TAMANHO_PAGINA = 25;
    private final NamedParameterJdbcOperations jdbc;
    private final EscopoFilialService escopos;

    public DreReceitaRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc, EscopoFilialService escopos) {
        this.jdbc = jdbc;
        this.escopos = escopos;
    }

    private record Consulta(String origem, MapSqlParameterSource parametros) {}

    private Consulta escopo() {
        var parametros = new MapSqlParameterSource();
        var escopo = escopos.escopoAtual();
        if (escopo.acessoTotal()) return new Consulta(ORIGEM, parametros);
        var filiais = escopo.filiaisOrdenadas().stream().map(f -> f.toLowerCase(Locale.ROOT)).toList();
        if (filiais.isEmpty()) return new Consulta(ORIGEM + " AND 1 = 0", parametros);
        return new Consulta(ORIGEM + " AND LOWER(filial_nome) IN (:permitidas)", parametros.addValue("permitidas", filiais));
    }

    private Consulta periodo(Consulta base, Filtro filtro, boolean acumulado) {
        var mes = filtro.competencia();
        var parametros = base.parametros().addValue("mes", Date.valueOf(mes.atDay(1)))
                .addValue("inicio", Date.valueOf(acumulado ? mes.atDay(1).withDayOfYear(1) : mes.atDay(1)))
                .addValue("fim", Date.valueOf(mes.plusMonths(1).atDay(1)));
        var sql = new StringBuilder(base.origem())
                .append(" AND data_referencia_faturamento_date >= :inicio AND data_referencia_faturamento_date < :fim");
        filtrar(sql, parametros, EMPRESA, "empresa", filtro.empresa());
        filtrar(sql, parametros, "filial_nome", "filial", filtro.filial());
        filtrar(sql, parametros, "centro_custo_nome", "centro", filtro.centro());
        return new Consulta(sql.toString(), parametros);
    }

    private static void filtrar(StringBuilder sql, MapSqlParameterSource params, String campo, String chave, String valor) {
        if (valor != null && !valor.isBlank()) {
            sql.append(" AND ").append(campo).append(" = :").append(chave);
            params.addValue(chave, valor.trim());
        }
    }

    List<String> filiaisEmpresa(String empresa, String filial) {
        var base = escopo();
        var origem = new StringBuilder(base.origem()).append(" AND filial_nome IS NOT NULL AND NULLIF(filial_cnpj,'') IS NOT NULL");
        filtrar(origem, base.parametros(), "filial_nome", "filial", filial);
        base.parametros().addValue("empresa",empresa);
        return jdbc.queryForList("SELECT filial_nome" + origem + " GROUP BY filial_nome HAVING MIN(" + EMPRESA
                + ")=:empresa AND MAX(" + EMPRESA + ")=:empresa",base.parametros(),String.class);
    }

    public List<Dimensao> dimensoes(YearMonth mes) {
        var consulta = periodo(escopo(), new Filtro(mes, null, null, null), true);
        return jdbc.query("SELECT DISTINCT " + EMPRESA + " AS empresa, filial_nome, centro_custo_nome"
                + consulta.origem() + " ORDER BY empresa, filial_nome, centro_custo_nome", consulta.parametros(),
                (rs, n) -> new Dimensao(rs.getString(1), rs.getString(2), rs.getString(3)));
    }

    public Resumo resumo(Filtro filtro) {
        var base = escopo();
        var historico = jdbc.queryForObject("SELECT MIN(data_referencia_faturamento_date), MAX(snapshot_em)"
                + base.origem(), base.parametros(), (rs, n) -> {
                    Date primeiro = rs.getDate(1);
                    LocalDateTime atualizado = rs.getObject(2, LocalDateTime.class);
                    return new Historico(primeiro == null ? null : primeiro.toLocalDate(),
                            atualizado == null ? null : TemporalJsonUtils.formatarUtcComoIsoComOffset(atualizado));
                });
        var consulta = periodo(base, filtro, true);
        String sql = """
                WITH receitas AS (
                    SELECT %s AS classe, %s AS tipo, data_referencia_faturamento_date AS dia, receita_bruta AS valor
                    %s
                )
                SELECT classe, tipo, COALESCE(SUM(CASE WHEN dia >= :mes THEN valor ELSE 0 END),0) AS mes,
                       COALESCE(SUM(valor),0) AS ano
                FROM receitas
                GROUP BY GROUPING SETS ((), (classe), (classe, tipo))
                """.formatted(CLASSE, TIPO, consulta.origem());
        var linhas = jdbc.query(sql, consulta.parametros(), (rs, n) ->
                new Linha(rs.getString(1), rs.getString(2), rs.getBigDecimal(3), rs.getBigDecimal(4)));
        return new Resumo(historico, linhas);
    }

    public Pagina fretes(Filtro filtro, String classe, String tipo, boolean acumulado, int pagina) {
        var consulta = periodo(escopo(), filtro, acumulado);
        var origem = new StringBuilder(consulta.origem());
        filtrar(origem, consulta.parametros(), CLASSE, "classe", classe);
        filtrar(origem, consulta.parametros(), TIPO, "tipo", tipo);
        // O Faturamento já zera os valores inelegíveis. O detalhe mostra os movimentos que compõem a soma.
        String sql = """
                SELECT numero_minuta, numero_cte, data_referencia_faturamento_date, filial_nome,
                       classificacao_nome, tipo_frete, receita_bruta
                """ + origem + "\n" + """
                 AND receita_bruta <> 0
                 ORDER BY data_referencia_faturamento_date DESC, frete_id DESC
                 OFFSET :pular ROWS FETCH NEXT :buscar ROWS ONLY
                """;
        consulta.parametros().addValue("pular", (long) pagina * TAMANHO_PAGINA).addValue("buscar", TAMANHO_PAGINA + 1);
        var itens = jdbc.query(sql, consulta.parametros(), (rs, n) ->
                new Frete(rs.getString(1), rs.getString(2), rs.getDate(3).toLocalDate(),
                        rs.getString(4), rs.getString(5), rs.getString(6), rs.getBigDecimal(7)));
        boolean temProxima = itens.size() > TAMANHO_PAGINA;
        return new Pagina(temProxima ? itens.subList(0, TAMANHO_PAGINA) : itens, temProxima);
    }
}
