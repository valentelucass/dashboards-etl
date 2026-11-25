package com.dashboard.api.repository;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.manifestos.ManifestosPerformanceDTO.CustoContratoDTO;
import com.dashboard.api.util.PeriodoOffsetDateTimeHelper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.time.LocalDate;
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

@SuppressWarnings({"rawtypes","unchecked"})
class DreTransporteRepositoryTest {
    private final NamedParameterJdbcOperations jdbc=mock(NamedParameterJdbcOperations.class);
    private final ManifestosPerformanceSqlRepository manifestos=mock(ManifestosPerformanceSqlRepository.class);
    private final RedeCredenciadaCustosRepository rede=mock(RedeCredenciadaCustosRepository.class);
    private final DreReceitaRepository receitas=mock(DreReceitaRepository.class);
    private final PeriodoOffsetDateTimeHelper tempo=mock(PeriodoOffsetDateTimeHelper.class);
    private final DreTransporteRepository repo=new DreTransporteRepository(jdbc,receitas,manifestos,rede,tempo);
    private final YearMonth outubro=YearMonth.of(2026,10);
    private final LocalDate hoje=LocalDate.of(2026,11,24);

    @Test void somaOHistoricoDisponivelDesdeJaneiroComAMesmaFilialSemDuplicarContratosOuConsolidacoes() throws Exception {
        when(tempo.hoje()).thenReturn(hoje);
        var rs=mock(ResultSet.class);
        when(rs.getObject(1,LocalDate.class)).thenReturn(LocalDate.of(2026,8,16));
        when(rs.getObject(2,LocalDate.class)).thenReturn(hoje);
        when(jdbc.queryForObject(contains("vw_fato_manifestos_dash"),any(MapSqlParameterSource.class),any(RowMapper.class)))
                .thenAnswer(i -> ((RowMapper)i.getArgument(2)).mapRow(rs,0));
        when(manifestos.custosPorContrato(any())).thenReturn(List.of(new CustoContratoDTO("Frota + PX",BigDecimal.TEN),
                new CustoContratoDTO("Agregado",new BigDecimal("500")),new CustoContratoDTO("Terceiro",new BigDecimal("100"))),
                List.of(new CustoContratoDTO("Agregado",new BigDecimal("1300")),new CustoContratoDTO("Terceiro",new BigDecimal("300"))));
        when(jdbc.queryForObject(anyString(),any(MapSqlParameterSource.class),eq(Integer.class))).thenReturn(31,77);
        when(rede.baseConsolidacoes(any(),eq(List.of("AGU")))).thenReturn("WITH numeradas AS (...) ");
        var cobrancas=mock(ResultSet.class);
        when(cobrancas.getBigDecimal(1)).thenReturn(new BigDecimal("98.12"),new BigDecimal("198.12"));
        when(jdbc.queryForObject(contains("n.linha_consolidacao=1 AND n.conferencia IS NULL AND EXISTS"),any(MapSqlParameterSource.class),any(RowMapper.class)))
                .thenAnswer(i -> ((RowMapper)i.getArgument(2)).mapRow(cobrancas,0));
        var valores=repo.resumo(new DreReceitaRepository.Filtro(outubro,null,"AGU",null));
        assertThat(valores).containsExactly(new DreTransporteRepository.Valor("D33",new BigDecimal("500"),new BigDecimal("1300"),false,true),
                new DreTransporteRepository.Valor("D34",new BigDecimal("98.12"),new BigDecimal("198.12"),false,true),
                new DreTransporteRepository.Valor("D35",new BigDecimal("100"),new BigDecimal("300"),false,true));
        var filtro=ArgumentCaptor.forClass(FiltroConsultaDTO.class);
        verify(manifestos,times(2)).custosPorContrato(filtro.capture());
        assertThat(filtro.getAllValues()).extracting(FiltroConsultaDTO::dataInicio)
                .containsExactly(outubro.atDay(1), LocalDate.of(2026,1,1));
        assertThat(filtro.getAllValues()).allSatisfy(f -> {
            assertThat(f.valores("filiais")).containsExactly("AGU");
            assertThat(f.dataFim()).isEqualTo(outubro.atEndOfMonth());
        });
    }

    @Test void janeiroSemOrigemFicaIndisponivelESomenteUmaConsultaDeCobertura() {
        when(tempo.hoje()).thenReturn(hoje);
        var janeiro = new DreReceitaRepository.Filtro(YearMonth.of(2026,1),null,null,null);
        assertThat(repo.resumo(janeiro)).allSatisfy(v -> {
            assertThat(v.mes()).isNull();
            assertThat(v.ano()).isNull();
        });
        verify(jdbc).queryForObject(contains("COUNT(DISTINCT data_arquivo)"),any(MapSqlParameterSource.class),eq(Integer.class));
        verifyNoInteractions(manifestos,rede);
    }

    @Test void empresaSemFiliaisOuCentroContabilNaoRetornaOCustoDeTodaARede() {
        when(tempo.hoje()).thenReturn(hoje);
        when(receitas.filiaisEmpresa("x",null)).thenReturn(List.of());
        assertThat(repo.resumo(new DreReceitaRepository.Filtro(outubro,"x",null,null))).isEmpty();
        var porCentro=new DreReceitaRepository.Filtro(outubro,null,null,"ADM");
        assertThat(repo.resumo(porCentro)).isEmpty();
        assertThat(repo.lancamentos(porCentro,"D34",false,0).itens()).isEmpty();
        verifyNoInteractions(jdbc,manifestos,rede);
    }
}
