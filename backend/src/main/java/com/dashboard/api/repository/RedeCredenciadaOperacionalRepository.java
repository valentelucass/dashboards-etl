package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.redecredenciada.RedeCredenciadaOperacionalDTO.Entrega;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.util.List;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class RedeCredenciadaOperacionalRepository {
    private final NamedParameterJdbcOperations jdbc;
    private final PerformanceDashboardSqlRepository performance;
    private final EscopoFilialService escopo;

    public RedeCredenciadaOperacionalRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc,
            PerformanceDashboardSqlRepository performance, EscopoFilialService escopo) {
        this.jdbc = jdbc;
        this.performance = performance;
        this.escopo = escopo;
    }

    public List<Entrega> entregas(FiltroConsultaDTO filtro, String parceiro, boolean coberturaCompleta) {
        var fonte = performance.entregasDaGestao(filtro, escopo.escopoAtual());
        String arquivo = coberturaCompleta ? "COUNT_BIG(a.minuta)" : "CAST(NULL AS bigint)";
        String documentos = coberturaCompleta ? """
                LEFT JOIN dbo.rede_credenciada_arquivos a
                    ON a.minuta = f.numero_minuta AND a.primeiro_arquivamento < :dataFim
                """ : "";
        String porParceiro = "";
        if (parceiro != null && !parceiro.isBlank()) {
            porParceiro = " AND f.responsavel_regiao_destino = :parceiro ";
            fonte.params().addValue("parceiro", parceiro.trim());
        }
        String sql = fonte.sql() + """
                SELECT f.previsao_entrega dia, f.responsavel_regiao_destino parceiro, COUNT_BIG(*) finalizadas,
                       SUM(f.comprovante_anexado) anexadas, %s arquivadas
                FROM performance f
                %s
                WHERE f.is_finalizada = 1 AND f.responsavel_regiao_destino LIKE N'%%| PARCEIRO%%'
                %s
                GROUP BY f.previsao_entrega, f.responsavel_regiao_destino
                ORDER BY dia, parceiro
                """.formatted(arquivo, documentos, porParceiro);
        return jdbc.query(sql, fonte.params(), (rs, linha) -> new Entrega(rs.getDate("dia").toLocalDate(),
                rs.getString("parceiro"), rs.getLong("finalizadas"), rs.getLong("anexadas"),
                rs.getObject("arquivadas", Long.class)));
    }
}
