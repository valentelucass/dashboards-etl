package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceContaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceOperacionalDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceOperacionalDTO.Dia;
import com.dashboard.api.dto.customerservice.CustomerServiceOperacionalDTO.Ocorrencia;
import com.dashboard.api.dto.customerservice.CustomerServiceOperacionalDTO.Status;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class CustomerServiceOperacionalRepository {
    // Cadastro de Ocorrências do ESL, conferido em 22/11/2026. A ação configurada
    // identifica os eventos de atendimento. "Finaliza a performance" mede outro critério.
    private static final List<Integer> TRATATIVAS = List.of(
            3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 23, 26, 27,
            28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 46, 47,
            57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 71, 72, 73, 74, 76, 77, 78,
            79, 80, 81, 82, 85, 87, 88, 90, 92, 93, 94, 96, 97, 98, 100, 104, 105,
            106, 116, 117, 118, 119, 120, 121, 125, 129, 130, 131, 135, 145, 505, 506);
    private static final List<Integer> BAIXAS_OU_FINALIZACOES = List.of(
            1, 2, 19, 24, 25, 50, 52, 53, 69, 112, 128, 132, 136, 137, 138, 139, 140, 142, 143);
    private static final List<Integer> AVARIAS_DE_CARGA = List.of(38, 78, 79);
    private static final List<Integer> EXTRAVIOS_DE_CARGA = List.of(23, 37, 80, 81);

    private final NamedParameterJdbcOperations jdbc;
    private final PerformanceDashboardSqlRepository performance;
    private final ColetasAgregadosSqlRepository coletas;
    private final ComprovantesArquivadosRepository comprovantes;
    private final EscopoFilialService escopoFilial;

    public CustomerServiceOperacionalRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc,
            PerformanceDashboardSqlRepository performance, ColetasAgregadosSqlRepository coletas,
            ComprovantesArquivadosRepository comprovantes, EscopoFilialService escopoFilial) {
        this.jdbc = jdbc;
        this.performance = performance;
        this.coletas = coletas;
        this.comprovantes = comprovantes;
        this.escopoFilial = escopoFilial;
    }

    public CustomerServiceOperacionalDTO consultar(FiltroConsultaDTO filtro, CustomerServiceContaDTO cliente, LocalDate hoje) {
        LocalDate corte = filtro.dataFim().isBefore(hoje) ? filtro.dataFim() : hoje;
        String documentos = CustomerServiceDocumentos.json(cliente.documentos(), true);
        var escopo = escopoFilial.escopoAtual();
        var fonte = performance.entregasDoCliente(filtro, escopo, documentos);
        String vinculo = titularesDasMinutas(escopo, fonte.params());
        fonte.params().addValue("corteExclusivo", corte.plusDays(1));
        boolean comArquivos = !corte.isBefore(filtro.dataInicio()) && arquivosDisponiveis(filtro.dataInicio(), corte, hoje);
        var entregas = lerEntregas(fonte, vinculo, comArquivos);
        var coleta = coletas.desempenhoDoCliente(filtro, documentos);
        var ocorrencias = lerOcorrencias(filtro.dataInicio(), corte, fonte.params(), vinculo);
        return new CustomerServiceOperacionalDTO(entregas.total, entregas.finalizadas, entregas.noPrazo,
                coleta.finalizadas(), coleta.noPrazo(), entregas.anexadas, entregas.arquivadas,
                entregas.peso, entregas.nf, entregas.frete, entregas.status, entregas.dias,
                ocorrencias.avarias, ocorrencias.extravios, ocorrencias.afetadas, ocorrencias.tipos);
    }

    private boolean arquivosDisponiveis(LocalDate inicio, LocalDate corte, LocalDate hoje) {
        var cobertura = comprovantes.coberturaArquivos(inicio, hoje);
        if (cobertura.dataFinal() == null || cobertura.dataFinal().isBefore(corte)) return false;
        LocalDate publicadaAte = cobertura.dataFinal().isBefore(hoje) ? cobertura.dataFinal() : hoje;
        return cobertura.diasCobertos() == ChronoUnit.DAYS.between(inicio, publicadaAte) + 1;
    }

    // Arquivos e ocorrências identificam o frete pela minuta. Um número dividido com
    // outro cliente ou fora das filiais permitidas não pode revelar os eventos dele.
    private static String titularesDasMinutas(EscopoFilialService.EscopoFilial escopo, MapSqlParameterSource params) {
        String filial = "";
        if (!escopo.acessoTotal()) {
            if (escopo.filiaisOrdenadas().isEmpty()) {
                filial = " AND 1 = 0";
            } else {
                filial = " AND f.[Responsável Região Destino Key] IN (:filiaisDaConta)";
                params.addValue("filiaisDaConta", escopo.filiaisOrdenadas());
            }
        }
        return """
                titulares AS (
                    SELECT f.[Nº Minuta] minuta FROM dbo.vw_fretes_powerbi f
                    LEFT JOIN %s conta ON conta.documento = f.[Pagador Doc]
                    WHERE f.[Nº Minuta] IS NOT NULL
                    GROUP BY f.[Nº Minuta]
                    HAVING MIN(CASE WHEN conta.documento IS NOT NULL %s THEN 1 ELSE 0 END) = 1
                       AND MAX(CASE WHEN f.[Tipo Frete] IS NULL OR f.[Tipo Frete] NOT IN (N'Substitute',N'Complementary') THEN 1 ELSE 0 END) = 1
                )
                """.formatted(CustomerServiceDocumentos.TABELA, filial);
    }

    private Entregas lerEntregas(PerformanceDashboardSqlRepository.ConsultaEntregas fonte, String vinculo, boolean comArquivos) {
        String arquivadas = comArquivos ? "COUNT_BIG(CASE WHEN f.is_finalizada=1 AND a.minuta IS NOT NULL THEN 1 END)"
                : "CAST(NULL AS bigint)";
        String join = comArquivos ? """
                LEFT JOIN titulares t ON t.minuta = f.numero_minuta
                LEFT JOIN dbo.rede_credenciada_arquivos a ON a.minuta=t.minuta
                """ : "";
        String sql = fonte.sql() + (comArquivos ? ", " + vinculo : "") + """
                SELECT GROUPING_ID(f.status_norm,f.data_previsao_entrega) grupo,
                       f.status_norm, f.data_previsao_entrega, COUNT_BIG(*) total,
                       COUNT_BIG(CASE WHEN f.is_finalizada=1 THEN 1 END) finalizadas,
                       COUNT_BIG(CASE WHEN f.is_no_prazo=1 THEN 1 END) no_prazo,
                       COUNT_BIG(CASE WHEN f.is_finalizada=1 AND f.comprovante_anexado=1 THEN 1 END) anexadas,
                       %s arquivadas,
                       CASE WHEN COUNT_BIG(*)=COUNT_BIG(f.peso_real_kg) THEN COALESCE(SUM(f.peso_real_kg),0) END peso,
                       CASE WHEN COUNT_BIG(*)=COUNT_BIG(f.valor_nf_cliente) THEN COALESCE(SUM(f.valor_nf_cliente),0) END nf,
                       CASE WHEN COUNT_BIG(*)=COUNT_BIG(f.valor_total_servico) THEN COALESCE(SUM(f.valor_total_servico),0) END frete
                FROM entregas_cliente f %s
                GROUP BY GROUPING SETS ((), (f.status_norm), (f.data_previsao_entrega))
                ORDER BY grupo, f.data_previsao_entrega, total DESC, f.status_norm
                """.formatted(arquivadas, join);
        return jdbc.query(sql, fonte.params(), rs -> {
            var resumo = new Entregas();
            while (rs.next()) {
                long qtd = rs.getLong("total");
                long finalizadas = rs.getLong("finalizadas");
                long noPrazo = rs.getLong("no_prazo");
                switch (rs.getInt("grupo")) {
                    case 1 -> resumo.status.add(new Status(rs.getString("status_norm"), qtd));
                    case 2 -> resumo.dias.add(new Dia(rs.getObject("data_previsao_entrega", LocalDate.class), qtd, finalizadas, noPrazo));
                    case 3 -> {
                        resumo.total = qtd;
                        resumo.finalizadas = finalizadas;
                        resumo.noPrazo = noPrazo;
                        resumo.anexadas = rs.getLong("anexadas");
                        resumo.arquivadas = rs.getObject("arquivadas", Long.class);
                        resumo.peso = rs.getBigDecimal("peso");
                        resumo.nf = rs.getBigDecimal("nf");
                        resumo.frete = rs.getBigDecimal("frete");
                    }
                    default -> throw new SQLException("Agrupamento de entregas desconhecido.");
                }
            }
            return resumo;
        });
    }

    private Incidentes lerOcorrencias(LocalDate inicio, LocalDate corte, MapSqlParameterSource params, String vinculo) {
        long dias = ChronoUnit.DAYS.between(inicio, corte) + 1;
        if (dias <= 0) return new Incidentes(null, null, null, null);
        try {
            Long prontos = jdbc.queryForObject("""
                    SELECT COUNT_BIG(*) FROM dbo.customer_service_cobertura_ocorrencias
                    WHERE dia>=:dataInicio AND dia<:corteExclusivo
                    """, params, Long.class);
            if (prontos == null || prontos != dias) return new Incidentes(null, null, null, null);
        } catch (DataAccessException ex) {
            if (ex.getMostSpecificCause() instanceof SQLException sql &&
                    (sql.getErrorCode() == 208 || sql.getErrorCode() == 5313)) return new Incidentes(null, null, null, null);
            throw ex;
        }
        params.addValue("tratativas", TRATATIVAS).addValue("finalizacoes", BAIXAS_OU_FINALIZACOES)
                .addValue("avariasCarga", AVARIAS_DE_CARGA).addValue("extraviosCarga", EXTRAVIOS_DE_CARGA);
        String sql = "WITH " + vinculo + """
                , registros AS (
                    SELECT o.minuta, COALESCE(NULLIF(TRIM(o.descricao), N''), N'Sem descrição') tipo,
                        CASE WHEN o.codigo IN (:avariasCarga) THEN 1
                             WHEN o.codigo IN (:extraviosCarga) THEN 2 END classe
                    FROM dbo.dashboard_performance_ocorrencias o JOIN titulares t ON t.minuta=o.minuta
                    WHERE o.ocorrido_em>=:dataInicio AND o.ocorrido_em<:corteExclusivo
                      AND (o.codigo IN (:tratativas) OR o.codigo IN (:finalizacoes))
                )
                SELECT GROUPING(tipo) total, tipo, COUNT_BIG(*) qtd,
                       COUNT_BIG(DISTINCT CASE WHEN classe=1 THEN minuta END) avarias,
                       COUNT_BIG(DISTINCT CASE WHEN classe=2 THEN minuta END) extravios,
                       COUNT_BIG(DISTINCT CASE WHEN classe IS NOT NULL THEN minuta END) afetadas
                FROM registros GROUP BY GROUPING SETS ((), (tipo)) ORDER BY total DESC, qtd DESC, tipo
                """;
        return jdbc.query(sql, params, rs -> {
            List<Ocorrencia> tipos = new ArrayList<>();
            long avarias = 0, extravios = 0, afetadas = 0;
            while (rs.next()) {
                if (rs.getInt("total") == 1) {
                    avarias = rs.getLong("avarias");
                    extravios = rs.getLong("extravios");
                    afetadas = rs.getLong("afetadas");
                } else {
                    tipos.add(new Ocorrencia(rs.getString("tipo"), rs.getLong("qtd")));
                }
            }
            return new Incidentes(avarias, extravios, afetadas, tipos);
        });
    }

    private static final class Entregas {
        long total, finalizadas, noPrazo, anexadas;
        Long arquivadas;
        BigDecimal peso, nf, frete;
        final List<Status> status = new ArrayList<>();
        final List<Dia> dias = new ArrayList<>();
    }
    private record Incidentes(Long avarias, Long extravios, Long afetadas, List<Ocorrencia> tipos) {}
}
