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
        repo.lancamentos(filtro,"Operadora","INTERNET",false,1);
        repo.lancamentos(filtro,"Operadora","INTERNET",true,0);
        var sql=ArgumentCaptor.forClass(String.class);
        var params=ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbc,times(3)).query(sql.capture(),params.capture(),any(RowMapper.class));
        assertThat(sql.getAllValues()).allSatisfy(s -> assertThat(s).contains("LOWER(p.[Filial]) IN (:permitidas)","p.[Ano de Competência]=:ano",
                "p.[Conta Contábil/Descrição] = :conta","p.[Fornecedor/Nome] = :fornecedor","p.[Centro de custo/Nome] = :centro",
                "p.[Conta Contábil/Valor]=p.[Valor]","p.[Centro de custo/Valor]=p.[Valor]","MIN(LEFT(filial_cnpj,8))=:empresa"));
        assertThat(params.getAllValues()).allSatisfy(p -> assertThat(p.getValues()).containsEntry("conta","INTERNET")
                .containsEntry("fornecedor","Operadora").containsEntry("filial","AGU").containsEntry("ano",2026).containsEntry("mes",10));
        assertThat(params.getAllValues().get(0).getValue("inicio")).isEqualTo(1);
        assertThat(params.getAllValues().get(1).getValues()).containsEntry("inicio",10).containsEntry("pular",25L);
        assertThat(params.getAllValues().get(2).getValue("inicio")).isEqualTo(1);
        assertThat(sql.getAllValues().get(0)).contains("COUNT_BIG(*)=COUNT_BIG(valor)");
        verify(jdbc).queryForObject(contains("LOWER(p.[Filial]) IN (:permitidas)"),any(MapSqlParameterSource.class),any(RowMapper.class));
    }

    @Test void acessoSemFiliaisNaoVeFornecedorContaNemDetalhe() {
        when(escopos.escopoAtual()).thenReturn(EscopoFilialService.EscopoFilial.semAcesso());
        repo.dimensoes(filtro);
        repo.resumo(filtro,null,null);
        repo.lancamentos(filtro,null,null,false,0);
        verify(jdbc,times(3)).query(contains("AND 1=0"),any(MapSqlParameterSource.class),any(RowMapper.class));
        verify(jdbc).queryForObject(contains("AND 1=0"),any(MapSqlParameterSource.class),any(RowMapper.class));
    }
}
