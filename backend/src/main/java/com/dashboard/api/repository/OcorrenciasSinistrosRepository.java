package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.service.ValidadorPeriodoService;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.time.LocalDate;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;

@Repository
public class OcorrenciasSinistrosRepository {
    private final NamedParameterJdbcOperations jdbc;
    private final EscopoFilialService escopos;
    private final ValidadorPeriodoService periodos;
    private final ObjectMapper json;
    private final String indicadores;
    private final String relacao;

    public OcorrenciasSinistrosRepository(@ConsultaAnalitica NamedParameterJdbcOperations jdbc, EscopoFilialService escopos,
                                           ValidadorPeriodoService periodos,ObjectMapper json) throws IOException {
        this.jdbc=jdbc;
        this.escopos=escopos;
        this.periodos=periodos;
        this.json=json;
        indicadores=sql("ocorrencias-indicadores");
        relacao=sql("sinistros-relacao");
    }

    private static String sql(String nome) throws IOException {
        return new ClassPathResource("sql/"+nome+".sql").getContentAsString(StandardCharsets.UTF_8);
    }

    public JsonNode indicadores(LocalDate inicio,LocalDate fim) {
        return consultar(indicadores,inicio,fim,new MapSqlParameterSource());
    }

    public JsonNode relacao(LocalDate inicio,LocalDate fim,int pagina,int tamanho) {
        if (pagina<0 || tamanho<1 || tamanho>200) throw new IllegalArgumentException("Paginação inválida");
        return consultar(relacao,inicio,fim,new MapSqlParameterSource("deslocamento",(long)pagina*tamanho).addValue("limite",tamanho));
    }

    private JsonNode consultar(String consulta,LocalDate inicio,LocalDate fim,MapSqlParameterSource p) {
        periodos.validar(inicio,fim);
        var escopo=escopos.escopoAtual();
        p.addValue("inicio",Date.valueOf(inicio)).addValue("fim",Date.valueOf(fim.plusDays(1))).addValue("global",escopo.acessoTotal()?1:0);
        var filiais=escopo.filiaisOrdenadas();
        if (!escopo.acessoTotal() && !filiais.isEmpty()) p.addValue("filiais",filiais);
        String sql=consulta;
        for (String marcador:Set.of("Frete","Evento","Sinistro","Caso")) {
            String coluna=switch(marcador) {
                case "Frete" -> "f.[Filial]";
                case "Evento" -> "o.filial";
                case "Sinistro" -> "s.[Filial/Nome]";
                default -> "s.filial";
            };
            String filtro=escopo.acessoTotal() ? "" : filiais.isEmpty() ? " AND 1=0 " : " AND "+coluna+" IN (:filiais) ";
            sql=sql.replace("/* escopo"+marcador+" */",filtro);
        }
        try {
            String resposta=jdbc.queryForObject(sql,p,String.class);
            return json.readTree(resposta);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Resposta inválida na consulta de ocorrências e sinistros",e);
        }
    }
}
