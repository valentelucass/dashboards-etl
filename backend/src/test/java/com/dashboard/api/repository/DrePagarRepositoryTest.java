package com.dashboard.api.repository;

import com.dashboard.api.service.acesso.EscopoFilialService;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked","rawtypes"})
class DrePagarRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final EscopoFilialService escopos = mock(EscopoFilialService.class);
    private final DrePagarRepository repo = new DrePagarRepository(jdbc,escopos);
    private final DreReceitaRepository.Filtro filtro = new DreReceitaRepository.Filtro(YearMonth.of(2026,10),"12345678","AGU","ADM");

    @Test void filtraValoresEDetalhePelaMesmaContaFornecedorCentroCompetenciaEFilialAutorizada() {
        when(escopos.escopoAtual()).thenReturn(new EscopoFilialService.EscopoFilial(false,List.of("AGU")));
        repo.resumo(filtro,"Operadora","INTERNET");
        repo.lancamentos(filtro,"Operadora","INTERNET",null,false,1);
        repo.lancamentos(filtro,"Operadora","INTERNET",null,true,0);
        var sql=ArgumentCaptor.forClass(String.class);
        var params=ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbc,times(3)).query(sql.capture(),params.capture(),any(RowMapper.class));
        assertThat(sql.getAllValues()).allSatisfy(s -> assertThat(s).contains("dbo.dashboard_dre_pagar","LOWER(p.[Filial]) IN (:permitidas)","p.ano=:ano",
                "p.[conta] = :conta","p.[fornecedor] = :fornecedor","p.[centro] = :centro","p.valor_centro","MIN(LEFT(filial_cnpj,8))=:empresa"));
        assertThat(params.getAllValues()).allSatisfy(p -> assertThat(p.getValues()).containsEntry("conta","INTERNET")
                .containsEntry("fornecedor","Operadora").containsEntry("filial","AGU").containsEntry("ano",2026).containsEntry("mes",10));
        assertThat(params.getAllValues().get(0).getValue("inicio")).isEqualTo(1);
        assertThat(params.getAllValues().get(1).getValues()).containsEntry("inicio",10).containsEntry("pular",25L);
        assertThat(params.getAllValues().get(2).getValue("inicio")).isEqualTo(1);
        assertThat(sql.getAllValues().get(0)).contains("COUNT_BIG(*)=COUNT_BIG(valor)","GROUP BY conta,linha_dre,mes",
                "SUM(realizado)","COUNT_BIG(realizado)<COUNT_BIG(*)");
        verify(jdbc).queryForObject(contains("LOWER(p.[Filial]) IN (:permitidas)"),any(MapSqlParameterSource.class),any(RowMapper.class));
    }

    @Test void detalheDeLinhaConservaContaFiltradaEscopoEOrdemDasApropriacoes() {
        when(escopos.escopoAtual()).thenReturn(new EscopoFilialService.EscopoFilial(false,List.of("AGU")));
        repo.lancamentos(filtro,"Receita","PIS A RECOLHER","D9",true,0);
        var sql=ArgumentCaptor.forClass(String.class);
        var parametros=ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbc).query(sql.capture(),parametros.capture(),any(RowMapper.class));
        assertThat(sql.getValue()).contains("p.[linha_dre] = :linha","p.[conta] = :conta","IN (:permitidas)","ORDER BY p.mes DESC,p.numero DESC,p.ordem");
        assertThat(parametros.getValue().getValues()).containsEntry("linha","D9").containsEntry("conta","PIS A RECOLHER").containsEntry("inicio",1);
    }

    @Test void acessoSemFiliaisNaoVeFornecedorContaNemDetalhe() {
        when(escopos.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.semAcesso());
        repo.dimensoes(filtro);
        repo.resumo(filtro,null,null);
        repo.lancamentos(filtro,null,null,null,false,0);
        verify(jdbc,times(3)).query(contains("AND 1=0"),any(MapSqlParameterSource.class),any(RowMapper.class));
        verify(jdbc).queryForObject(contains("AND 1=0"),any(MapSqlParameterSource.class),any(RowMapper.class));
    }
}
