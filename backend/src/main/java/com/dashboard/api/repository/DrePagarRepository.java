package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.repository.DreReceitaRepository.Filtro;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class DrePagarRepository {
    public record Opcao(String tipo, String nome) {}
    public record Linha(String conta, BigDecimal mes, BigDecimal ano) {}
    public record Historico(LocalDate primeiraEmissao, LocalDateTime atualizadoEm) {}
    public record Resumo(Historico historico, List<Linha> valores) {}
    public record Lancamento(long numero, String documento, String filial, String centro, String fornecedor,
                            String conta, Integer mes, Integer ano, BigDecimal valor) {}
    public record Pagina(List<Lancamento> itens, boolean temProxima) {}

    private static final String ORIGEM = " FROM dbo.vw_contas_a_pagar_powerbi p";
    private static final int TAMANHO = 25;
    private final NamedParameterJdbcOperations jdbc;
    private final EscopoFilialService escopos;

    public DrePagarRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc, EscopoFilialService escopos) {
        this.jdbc = jdbc;
        this.escopos = escopos;
    }

    private record Consulta(String sql, MapSqlParameterSource params) {}

    private Consulta base() {
        var params = new MapSqlParameterSource();
        var escopo = escopos.escopoAtual();
        String sql = ORIGEM + " WHERE 1=1";
        if (!escopo.acessoTotal()) {
            var filiais = escopo.filiaisOrdenadas().stream().map(f -> f.toLowerCase(Locale.ROOT)).toList();
            if (filiais.isEmpty()) sql += " AND 1=0";
            else {
                sql += " AND LOWER(p.[Filial]) IN (:permitidas)";
                params.addValue("permitidas", filiais);
            }
        }
        return new Consulta(sql, params);
    }

    private Consulta periodo(Filtro f, boolean acumulado) {
        var base = base();
        String sql = base.sql() + " AND p.[Ano de Competência]=:ano AND p.[Mês de Competência] BETWEEN :inicio AND :mes";
        var params = base.params().addValue("ano", f.competencia().getYear())
                .addValue("mes", f.competencia().getMonthValue())
                .addValue("inicio", acumulado ? 1 : f.competencia().getMonthValue());
        if (informado(f.empresa())) {
            // O relatório de títulos só traz o nome da filial. Exige um CNPJ base inequívoco.
            sql += """
                     AND p.[Filial] IN (
                         SELECT filial_nome FROM dbo.fato_fretes_faturamento
                         WHERE excluido_na_origem=0 AND NULLIF(filial_cnpj,'') IS NOT NULL
                         GROUP BY filial_nome HAVING MIN(LEFT(filial_cnpj,8))=:empresa AND MAX(LEFT(filial_cnpj,8))=:empresa)
                    """;
            params.addValue("empresa", f.empresa().trim());
        }
        return new Consulta(sql, params);
    }

    private static boolean informado(String s) { return s != null && !s.isBlank(); }

    private static String criterio(String coluna, String chave, String valor, MapSqlParameterSource params) {
        if (!informado(valor)) return "";
        params.addValue(chave, valor.trim());
        return " AND p.[" + coluna + "] = :" + chave;
    }

    private Consulta movimentos(Filtro f, String fornecedor, String conta, boolean acumulado) {
        var base = periodo(f, acumulado);
        var params = base.params();
        String sql = base.sql() + criterio("Filial", "filial", f.filial(), params)
                + criterio("Centro de custo/Nome", "centro", f.centro(), params)
                + criterio("Fornecedor/Nome", "fornecedor", fornecedor, params)
                + criterio("Conta Contábil/Descrição", "conta", conta, params);
        return new Consulta(sql, params);
    }

    public List<Opcao> dimensoes(Filtro f) {
        var consulta = periodo(f, true);
        var p = consulta.params();
        String filial = "1=1" + criterio("Filial","filial", f.filial(),p);
        String centro = filial + criterio("Centro de custo/Nome","centro", f.centro(),p);
        String sql = """
                WITH movimentos AS (SELECT p.* %s)
                SELECT op.tipo, op.nome FROM movimentos p
                CROSS APPLY (VALUES ('filial',p.[Filial]),
                    ('centro',CASE WHEN %s THEN p.[Centro de custo/Nome] END),
                    ('conta',CASE WHEN %s THEN p.[Conta Contábil/Descrição] END),
                    ('fornecedor',CASE WHEN %s THEN p.[Fornecedor/Nome] END)) op(tipo,nome)
                WHERE NULLIF(op.nome,'') IS NOT NULL GROUP BY op.tipo,op.nome ORDER BY op.tipo,op.nome
                """.formatted(consulta.sql(), filial, centro, centro);
        return jdbc.query(sql, p, (rs,n) -> new Opcao(rs.getString(1),rs.getString(2)));
    }

    // Se a conta e o centro são ambos parciais, a interseção depende do rateio de Custos.
    private static String valor(Filtro f) {
        return informado(f.centro()) ? """
                CASE WHEN p.[Conta Contábil/Valor]=p.[Valor] THEN p.[Centro de custo/Valor]
                     WHEN p.[Centro de custo/Valor]=p.[Valor] THEN p.[Conta Contábil/Valor] END
                """ : "p.[Conta Contábil/Valor]";
    }

    public Resumo resumo(Filtro f, String fornecedor, String conta) {
        var base = base();
        var historico = jdbc.queryForObject("SELECT MIN(p.[Emissão]), MAX(p.[Data de extracao])" + base.sql(), base.params(),
                (rs,n) -> new Historico(rs.getObject(1, LocalDate.class), rs.getObject(2, LocalDateTime.class)));
        var c = movimentos(f, fornecedor, conta, true);
        String sql = """
                WITH movimentos AS (SELECT p.[Conta Contábil/Descrição] AS conta, p.[Mês de Competência] AS mes,
                       %s AS valor %s)
                SELECT conta,
                    CASE WHEN COUNT(CASE WHEN mes=:mes THEN 1 END)=COUNT(CASE WHEN mes=:mes THEN valor END)
                        THEN SUM(CASE WHEN mes=:mes THEN valor ELSE 0 END) END,
                    CASE WHEN COUNT_BIG(*)=COUNT_BIG(valor) THEN SUM(valor) END
                FROM movimentos WHERE NULLIF(conta,'') IS NOT NULL GROUP BY conta
                """.formatted(valor(f),c.sql());
        return new Resumo(historico, jdbc.query(sql, c.params(), (rs,n) ->
                new Linha(rs.getString(1),rs.getBigDecimal(2),rs.getBigDecimal(3))));
    }

    public Pagina lancamentos(Filtro f, String fornecedor, String conta, boolean acumulado, int pagina) {
        var c = movimentos(f, fornecedor, conta, acumulado);
        String sql = """
                SELECT p.[Lançamento a Pagar/N°],p.[N° Documento],p.[Filial],p.[Centro de custo/Nome],
                    p.[Fornecedor/Nome],p.[Conta Contábil/Descrição],p.[Mês de Competência],p.[Ano de Competência],
                    %s %s ORDER BY p.[Mês de Competência] DESC,p.[Lançamento a Pagar/N°] DESC
                    OFFSET :pular ROWS FETCH NEXT :buscar ROWS ONLY
                """.formatted(valor(f),c.sql());
        c.params().addValue("pular",(long) pagina*TAMANHO).addValue("buscar",TAMANHO+1);
        var itens = jdbc.query(sql,c.params(),(rs,n) -> new Lancamento(rs.getLong(1),rs.getString(2),rs.getString(3),
                rs.getString(4),rs.getString(5),rs.getString(6),rs.getInt(7),rs.getInt(8),rs.getBigDecimal(9)));
        boolean mais = itens.size() > TAMANHO;
        return new Pagina(mais ? itens.subList(0,TAMANHO) : itens,mais);
    }
}
