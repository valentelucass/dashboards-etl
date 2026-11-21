package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.dto.redecredenciada.RedeCredenciadaCustosDTO;
import com.dashboard.api.dto.redecredenciada.RedeCredenciadaCustosDTO.Linha;
import com.dashboard.api.dto.redecredenciada.RedeCredenciadaCustosDTO.Totais;
import com.dashboard.api.service.ValidadorPeriodoService;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.util.FilialKeyUtils;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RedeCredenciadaCustosRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final ValidadorPeriodoService periodo;
    private final EscopoFilialService escopo;
    private final String consulta;

    public RedeCredenciadaCustosRepository(@ConsultaAnalitica NamedParameterJdbcTemplate jdbc,
            ValidadorPeriodoService periodo, EscopoFilialService escopo) throws IOException {
        this.jdbc = jdbc;
        this.periodo = periodo;
        this.escopo = escopo;
        this.consulta = new ClassPathResource("sql/rede-credenciada-custos.sql")
                .getContentAsString(StandardCharsets.UTF_8);
    }

    public RedeCredenciadaCustosDTO consultar(LocalDate inicio, LocalDate fim,
            List<String> parceiros, List<String> status) {
        periodo.validar(inicio, fim);
        var parametros = new MapSqlParameterSource("dataInicio", Date.valueOf(inicio))
                .addValue("dataFim", Date.valueOf(fim));
        var acesso = escopo.escopoAtual();
        String sql = consulta;
        if (!acesso.acessoTotal()) {
            var filiais = FilialKeyUtils.normalizarCodigosParaFiltro(acesso.filiaisOrdenadas());
            String permitido = filiais.isEmpty() ? "1=0" : "c.filial_key IN (:filiais)";
            if (!filiais.isEmpty()) {
                parametros.addValue("filiais", filiais);
            }
            sql = sql.replace("/* acesso */ 1=1", permitido);
        }
        var filtros = new StringBuilder();
        if (parceiros != null && !parceiros.isEmpty()) {
            filtros.append(" AND b.parceiro IN (:parceiros)");
            parametros.addValue("parceiros", parceiros);
        }
        if (status != null && !status.isEmpty()) {
            filtros.append(" AND b.situacao IN (:status)");
            parametros.addValue("status", status);
        }
        sql = sql.replace("/* filtros */", filtros.toString());
        int cobertos = jdbc.queryForObject("""
                SELECT COUNT(DISTINCT data_arquivo) FROM dbo.rede_credenciada_cobertura
                WHERE entidade = 'CONSOLIDACAO_DETALHADA'
                  AND data_arquivo BETWEEN :dataInicio AND :dataFim
                """, parametros, Integer.class);
        return jdbc.query(sql, parametros, rs -> {
            List<Linha> linhas = new ArrayList<>();
            Totais totais = null;
            while (rs.next()) {
                if (rs.getInt("total") == 1) {
                    totais = lerTotais(rs);
                } else {
                    linhas.add(lerLinha(rs));
                }
            }
            if (totais == null) {
                if (!linhas.isEmpty()) {
                    throw new SQLException("Consulta de custos não retornou o total das consolidações.");
                }
                totais = new Totais(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            }
            return new RedeCredenciadaCustosDTO(inicio, fim, "Emissão da consolidação", "ESL 11067",
                    cobertos, Math.toIntExact(ChronoUnit.DAYS.between(inicio, fim) + 1), totais, linhas);
        });
    }

    private static Linha lerLinha(ResultSet rs) throws SQLException {
        return new Linha(rs.getDate("data_emissao").toLocalDate(), rs.getString("situacao"),
                rs.getString("parceiro"), rs.getLong("consolidacoes"), rs.getLong("cobrado_centavos"),
                rs.getLong("calculado_centavos"), rs.getLong("sem_cobrado"), rs.getLong("sem_calculado"),
                rs.getLong("calculado_zero"), rs.getLong("cobrado_zero"));
    }

    private static Totais lerTotais(ResultSet rs) throws SQLException {
        return new Totais(rs.getLong("consolidacoes"), rs.getLong("cobrado_centavos"),
                rs.getLong("calculado_centavos"), rs.getLong("sem_cobrado"), rs.getLong("sem_calculado"),
                rs.getLong("calculado_zero"), rs.getLong("cobrado_zero"), rs.getLong("frete_centavos"),
                rs.getLong("fretes"), rs.getLong("cobrado_vinculado_centavos"), rs.getLong("sem_frete"));
    }
}
