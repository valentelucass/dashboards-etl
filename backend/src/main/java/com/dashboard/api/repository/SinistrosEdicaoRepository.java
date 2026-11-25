package com.dashboard.api.repository;

import com.dashboard.api.dto.sinistros.SinistrosFormularios.*;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.sql.Date;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class SinistrosEdicaoRepository {
    private final NamedParameterJdbcOperations jdbc;
    private final EscopoFilialService escopos;

    public SinistrosEdicaoRepository(NamedParameterJdbcOperations jdbc,EscopoFilialService escopos) {
        this.jdbc=jdbc;
        this.escopos=escopos;
    }

    @Transactional
    public void salvarAcompanhamento(long numero,Acompanhamento dados,String usuario) {
        gravar(numero,dados,usuario,null);
    }

    @Transactional
    public void alterarCampo(long numero,AlteracaoCampo dados,String usuario) {
        Campo campo=dados.campo();
        BigDecimal valor=campo==Campo.statusCorretora || dados.valor().isEmpty() ? null : new BigDecimal(dados.valor());
        var ajuste=new Acompanhamento(campo==Campo.statusCorretora ? dados.valor() : "Pendente",
            campo==Campo.franquia ? valor : null,campo==Campo.salvados ? valor : null,dados.revisao());
        gravar(numero,ajuste,usuario,campo);
    }

    private void gravar(long numero,Acompanhamento dados,String usuario,Campo campo) {
        var p=new MapSqlParameterSource("numero",numero).addValue("status",dados.statusCorretora())
            .addValue("franquia",dados.franquia(),java.sql.Types.DECIMAL).addValue("salvados",dados.salvados(),java.sql.Types.DECIMAL)
            .addValue("revisao",dados.revisao()).addValue("usuario",usuario)
            .addValue("mudarStatus",campo==null || campo==Campo.statusCorretora ? 1 : 0)
            .addValue("mudarFranquia",campo==null || campo==Campo.franquia ? 1 : 0)
            .addValue("mudarSalvados",campo==null || campo==Campo.salvados ? 1 : 0);
        var escopo=escopos.escopoAtual();
        var filiais=escopo.filiaisOrdenadas();
        String filtro="";
        if (!escopo.acessoTotal()) {
            filtro=" AND 1=0";
            if (!filiais.isEmpty()) {
                filtro=" AND filial IN (:filiais)";
                p.addValue("filiais",filiais);
            }
        }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM acesso.sinistros_casos WHERE numero=:numero"+filtro,p,Integer.class)==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Sinistro indisponível");
        Integer atual=jdbc.queryForObject("SELECT ISNULL(MAX(revisao),0) FROM acesso.sinistro_acompanhamento WITH(UPDLOCK,HOLDLOCK) WHERE numero=:numero",p,Integer.class);
        conferirRevisao(dados.revisao(),atual);
        if (atual==0) {
            jdbc.update("""
                INSERT INTO acesso.sinistro_acompanhamento(numero,status_corretora,franquia,salvados,revisao,alterado_por)
                VALUES(:numero,:status,:franquia,:salvados,1,:usuario)
                """,p);
        } else {
            jdbc.update("""
                UPDATE acesso.sinistro_acompanhamento SET
                   status_corretora=CASE WHEN :mudarStatus=1 THEN :status ELSE status_corretora END,
                   franquia=CASE WHEN :mudarFranquia=1 THEN :franquia ELSE franquia END,
                   salvados=CASE WHEN :mudarSalvados=1 THEN :salvados ELSE salvados END,
                   revisao=revisao+1,alterado_por=:usuario,alterado_em=SYSUTCDATETIME() WHERE numero=:numero
                """,p);
        }
    }

    public boolean acessoGlobal() { return escopos.escopoAtual().acessoTotal(); }

    private void validarGestaoApolice() {
        if (!acessoGlobal()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"A apólice abrange todas as filiais");
    }

    public List<ApoliceCadastrada> apolices() {
        validarGestaoApolice();
        return jdbc.query("SELECT id,numero,inicio,fim,valor_segurado,revisao FROM acesso.sinistro_apolices ORDER BY inicio DESC,numero",
            (rs,n)->new ApoliceCadastrada(rs.getInt(1),rs.getString(2),rs.getObject(3,LocalDate.class),
                rs.getObject(4,LocalDate.class),rs.getBigDecimal(5),rs.getInt(6)));
    }

    @Transactional
    public void salvarApolice(Integer id,Apolice dados,String usuario) {
        validarGestaoApolice();
        if (dados.fim().isBefore(dados.inicio())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Fim anterior ao início da vigência");
        var p=new MapSqlParameterSource().addValue("id",id,java.sql.Types.INTEGER).addValue("numero",dados.numero().trim())
            .addValue("inicio",Date.valueOf(dados.inicio())).addValue("fim",Date.valueOf(dados.fim()))
            .addValue("valor",dados.valorSegurado()).addValue("usuario",usuario);
        if (id!=null) {
            var revisoes=jdbc.queryForList("SELECT revisao FROM acesso.sinistro_apolices WITH(UPDLOCK,HOLDLOCK) WHERE id=:id",p,Integer.class);
            if (revisoes.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Apólice indisponível");
            conferirRevisao(dados.revisao(),revisoes.get(0));
        } else conferirRevisao(dados.revisao(),0);
        int sobrepostas=jdbc.queryForObject("""
            SELECT COUNT(*) FROM acesso.sinistro_apolices WITH(UPDLOCK,HOLDLOCK)
            WHERE numero=:numero AND inicio<=:fim AND fim>=:inicio AND (:id IS NULL OR id<>:id)
            """,p,Integer.class);
        if (sobrepostas>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Já existe vigência desse número de apólice no período");
        if (id==null) jdbc.update("INSERT INTO acesso.sinistro_apolices(numero,inicio,fim,valor_segurado,alterado_por) VALUES(:numero,:inicio,:fim,:valor,:usuario)",p);
        else jdbc.update("""
            UPDATE acesso.sinistro_apolices SET numero=:numero,inicio=:inicio,fim=:fim,valor_segurado=:valor,
                revisao=revisao+1,alterado_por=:usuario,alterado_em=SYSUTCDATETIME() WHERE id=:id
            """,p);
    }

    private static void conferirRevisao(int recebida,int atual) {
        if (recebida!=atual) throw new ResponseStatusException(HttpStatus.CONFLICT,"Este registro mudou. Reabra para ver os valores atuais.");
    }
}
