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

    public List<Entrega> entregas(FiltroConsultaDTO filtro, String parceiro, boolean temArquivamentosPublicados) {
        var fonte = performance.entregasPorResponsavel(filtro, escopo.escopoAtual(), true);
        String arquivo = temArquivamentosPublicados ? "COUNT_BIG(a.minuta)" : "CAST(NULL AS bigint)";
        String documentos = temArquivamentosPublicados ? """
                LEFT JOIN dbo.rede_credenciada_arquivos a
                    ON a.minuta = f.numero_minuta
                """ : "";
        String porParceiro = "";
        if (parceiro != null && !parceiro.isBlank()) {
            porParceiro = " AND p.parceiro = :parceiro ";
            fonte.params().addValue("parceiro", parceiro.trim());
        }
        String sql = fonte.sql() + """
                SELECT f.previsao_entrega dia, p.parceiro, COUNT_BIG(*) finalizadas,
                       SUM(f.comprovante_anexado) anexadas, %s arquivadas
                FROM performance f
                CROSS APPLY acesso.rede_executor_entrega(f.numero_minuta, f.manifesto_entrega, f.responsavel_regiao_destino, f.data_frete) p
                %s
                WHERE f.is_finalizada = 1
                %s
                GROUP BY f.previsao_entrega, p.parceiro
                ORDER BY dia, parceiro
                """.formatted(arquivo, documentos, porParceiro);
        return jdbc.query(sql, fonte.params(), (rs, linha) -> new Entrega(rs.getDate("dia").toLocalDate(),
                rs.getString("parceiro"), rs.getLong("finalizadas"), rs.getLong("anexadas"),
                rs.getObject("arquivadas", Long.class)));
    }
}
