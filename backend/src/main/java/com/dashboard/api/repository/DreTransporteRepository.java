package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.CustoContratoDTO;
import com.dashboard.api.repository.DreReceitaRepository.Filtro;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class DreTransporteRepository {
    public record Valor(String id, BigDecimal mes, BigDecimal ano, boolean mesParcial, boolean anoParcial) {}
    public record Movimento(String documento, LocalDate data, String filial, String responsavel, BigDecimal valor) {}
    public record Pagina(List<Movimento> itens, boolean temProxima) {}
    private record Cobertura(LocalDate primeiro, LocalDate atualizado) {
        boolean intersecta(LocalDate inicio, LocalDate fim) {
            return primeiro != null && atualizado != null && !primeiro.isAfter(fim) && !atualizado.isBefore(inicio);
        }
        boolean cobre(LocalDate inicio, LocalDate fim, LocalDate hoje) {
            LocalDate referencia = fim.equals(hoje) ? fim.withDayOfMonth(1) : fim;
            return primeiro != null && atualizado != null && !primeiro.isAfter(inicio) && !atualizado.isBefore(referencia);
        }
    }
    private record TotalRede(BigDecimal valor, boolean parcial) {}
    private static final String CONSOLIDACOES_APURADAS = """
             FROM numeradas n WHERE n.linha_consolidacao=1 AND n.conferencia IS NULL AND EXISTS (
               SELECT 1 FROM dbo.rede_credenciada_cobertura c
               WHERE c.entidade='CONSOLIDACAO_DETALHADA' AND c.data_arquivo=n.data_emissao)
            """;

    private final NamedParameterJdbcOperations jdbc;
    private final DreReceitaRepository receitas;
    private final ManifestosPerformanceSqlRepository manifestos;
    private final RedeCredenciadaCustosRepository rede;
    private final PeriodoOffsetDateTimeHelper calendario;

    public DreTransporteRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc, DreReceitaRepository receitas,
            ManifestosPerformanceSqlRepository manifestos, RedeCredenciadaCustosRepository rede, PeriodoOffsetDateTimeHelper calendario) {
        this.jdbc=jdbc;
        this.receitas=receitas;
        this.manifestos=manifestos;
        this.rede=rede;
        this.calendario=calendario;
    }

    private List<String> filiais(Filtro f) {
        if (f.empresa()==null || f.empresa().isBlank()) return f.filial()==null || f.filial().isBlank() ? null : List.of(f.filial());
        return receitas.filiaisEmpresa(f.empresa(),f.filial());
    }

    private LocalDate fim(Filtro f) {
        LocalDate hoje=calendario.hoje(), fim=f.competencia().atEndOfMonth();
        return fim.isAfter(hoje) ? hoje : fim;
    }

    private FiltroConsultaDTO filtroManifesto(LocalDate inicio, LocalDate fim, List<String> filiais, String contrato) {
        var filtros=new HashMap<String,List<String>>();
        if(filiais!=null) filtros.put("filiais",filiais);
        if(contrato!=null) filtros.put("tiposContrato",List.of(contrato));
        return new FiltroConsultaDTO(inicio,fim,filtros);
    }

    private MapSqlParameterSource periodo(LocalDate inicio, LocalDate fim) {
        return new MapSqlParameterSource("dataInicio", Date.valueOf(inicio)).addValue("dataFim",Date.valueOf(fim));
    }

    private TotalRede custoRede(LocalDate inicio, LocalDate fim, List<String> filiais) {
        var params=periodo(inicio,fim);
        var dias=jdbc.queryForObject("""
                SELECT COUNT(DISTINCT data_arquivo) FROM dbo.rede_credenciada_cobertura
                WHERE entidade='CONSOLIDACAO_DETALHADA' AND data_arquivo BETWEEN :dataInicio AND :dataFim
                """,params,Integer.class);
        if (dias==null || dias==0) return new TotalRede(null, false);
        boolean faltamDias = dias < ChronoUnit.DAYS.between(inicio,fim)+1;
        String sql = rede.baseConsolidacoes(params,filiais) + """
                , custos_mensais AS (
                    SELECT CASE WHEN COUNT_BIG(*)=COUNT_BIG(cobrado) THEN SUM(cobrado) END AS realizado
                """ + CONSOLIDACOES_APURADAS + """
                    GROUP BY YEAR(data_emissao), MONTH(data_emissao))
                SELECT CASE WHEN COUNT_BIG(*)=0 THEN 0 ELSE SUM(realizado) END,
                       CASE WHEN COUNT_BIG(realizado)<COUNT_BIG(*) THEN 1 ELSE 0 END
                FROM custos_mensais
                """;
        return jdbc.queryForObject(sql,params,(rs,n) -> new TotalRede(rs.getBigDecimal(1),faltamDias || rs.getBoolean(2)));
    }

    private static BigDecimal custoManifestos(List<CustoContratoDTO> linhas, String contrato) {
        if(linhas==null) return null;
        return linhas.stream().filter(c -> contrato.equalsIgnoreCase(c.tipoContrato())).map(CustoContratoDTO::custoTotal)
                .findFirst().orElse(BigDecimal.ZERO);
    }

    public List<Valor> resumo(Filtro f) {
        LocalDate mes=f.competencia().atDay(1), ano=mes.withDayOfYear(1), fim=fim(f);
        if ((f.centro()!=null && !f.centro().isBlank()) || mes.isAfter(fim)) return List.of();
        var filiais=filiais(f);
        if(filiais!=null && filiais.isEmpty()) return List.of();
        // O acumulado soma os documentos publicados e informa quando a cobertura é parcial.
        var cobertura=jdbc.queryForObject("""
                SELECT CAST(MIN([Data criação]) AS date), CAST(MAX([Data de extracao]) AS date)
                FROM dbo.vw_fato_manifestos_dash
                """, new MapSqlParameterSource(), (rs,n) -> new Cobertura(rs.getObject(1,LocalDate.class),rs.getObject(2,LocalDate.class)));
        var lancMes=cobertura!=null && cobertura.intersecta(mes,fim)
                ? manifestos.custosPorContrato(filtroManifesto(mes,fim,filiais,null)) : null;
        var lancAno=mes.equals(ano) ? lancMes : cobertura!=null && cobertura.intersecta(ano,fim)
                ? manifestos.custosPorContrato(filtroManifesto(ano,fim,filiais,null)) : null;
        var parceiroMes=custoRede(mes,fim,filiais);
        var parceiroAno=mes.equals(ano) ? parceiroMes : custoRede(ano,fim,filiais);
        boolean mesParcial=lancMes!=null && !cobertura.cobre(mes,fim,calendario.hoje());
        boolean anoParcial=lancAno!=null && !cobertura.cobre(ano,fim,calendario.hoje());
        return List.of(new Valor("D33",custoManifestos(lancMes,"Agregado"),custoManifestos(lancAno,"Agregado"),mesParcial,anoParcial),
                new Valor("D34",parceiroMes.valor(),parceiroAno.valor(),parceiroMes.parcial(),parceiroAno.parcial()),
                new Valor("D35",custoManifestos(lancMes,"Terceiro"),custoManifestos(lancAno,"Terceiro"),mesParcial,anoParcial));
    }

    public Pagina lancamentos(Filtro f, String linha, boolean acumulado, int pagina) {
        LocalDate mes=f.competencia().atDay(1), inicio=acumulado ? mes.withDayOfYear(1) : mes, fim=fim(f);
        var filiais=filiais(f);
        if (inicio.isAfter(fim) || (f.centro()!=null && !f.centro().isBlank()) || (filiais!=null && filiais.isEmpty())) return new Pagina(List.of(),false);
        List<Movimento> itens;
        if (linha.equals("D34")) {
            var params=periodo(inicio,fim);
            String sql=rede.baseConsolidacoes(params,filiais) + """
                     SELECT consolidacao,data_emissao,filial_emissora,parceiro,cobrado
                    """ + CONSOLIDACOES_APURADAS + " ORDER BY data_emissao DESC,consolidacao DESC OFFSET :pular ROWS FETCH NEXT 26 ROWS ONLY";
            itens=jdbc.query(sql,params.addValue("pular",(long)pagina*25),(rs,n) -> new Movimento(rs.getString(1),
                    rs.getDate(2).toLocalDate(),rs.getString(3),rs.getString(4),rs.getBigDecimal(5)));
        } else {
            String tipo=switch(linha) {case "D33" -> "agregado"; case "D35" -> "terceiro"; default -> throw new IllegalArgumentException("Conta de transporte inválida");};
            itens=manifestos.lancamentosDre(filtroManifesto(inicio,fim,filiais,tipo),pagina);
        }
        boolean mais=itens.size()>25;
        return new Pagina(mais ? itens.subList(0,25) : itens,mais);
    }
}
