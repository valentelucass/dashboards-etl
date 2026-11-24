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

    @Test void excluiContratosDeFrotaEConsolidacoesEmConferenciaEPreservaAnoIncompleto() throws Exception {
        when(tempo.hoje()).thenReturn(hoje);
        var rs=mock(ResultSet.class);
        when(rs.getObject(1,LocalDate.class)).thenReturn(LocalDate.of(2026,8,16));
        when(rs.getObject(2,LocalDate.class)).thenReturn(hoje);
        when(jdbc.queryForObject(anyString(),any(MapSqlParameterSource.class),any(RowMapper.class)))
                .thenAnswer(i -> ((RowMapper)i.getArgument(2)).mapRow(rs,0));
        when(manifestos.custosPorContrato(any())).thenReturn(List.of(new CustoContratoDTO("Frota + PX",BigDecimal.TEN),
                new CustoContratoDTO("Agregado",new BigDecimal("500")),new CustoContratoDTO("Terceiro",new BigDecimal("100"))));
        when(jdbc.queryForObject(anyString(),any(MapSqlParameterSource.class),eq(Integer.class))).thenReturn(31,31);
        when(rede.baseConsolidacoes(any(),eq(List.of("AGU")))).thenReturn("WITH numeradas AS (...) ");
        when(jdbc.queryForObject(contains("linha_consolidacao=1 AND conferencia IS NULL"),any(MapSqlParameterSource.class),eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("98.12"));
        var valores=repo.resumo(new DreReceitaRepository.Filtro(outubro,null,"AGU",null));
        assertThat(valores).containsExactly(new DreTransporteRepository.Valor("D33",new BigDecimal("500"),null),
                new DreTransporteRepository.Valor("D34",new BigDecimal("98.12"),null),
                new DreTransporteRepository.Valor("D35",new BigDecimal("100"),null));
        var filtro=ArgumentCaptor.forClass(FiltroConsultaDTO.class);
        verify(manifestos).custosPorContrato(filtro.capture());
        assertThat(filtro.getValue().valores("filiais")).containsExactly("AGU");
        assertThat(filtro.getValue().dataInicio()).isEqualTo(outubro.atDay(1));
        assertThat(filtro.getValue().dataFim()).isEqualTo(outubro.atEndOfMonth());
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
