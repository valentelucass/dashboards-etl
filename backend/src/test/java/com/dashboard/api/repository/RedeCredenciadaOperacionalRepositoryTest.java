package com.dashboard.api.repository;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("unchecked")
class RedeCredenciadaOperacionalRepositoryTest {
    private final NamedParameterJdbcOperations jdbc = mock(NamedParameterJdbcOperations.class);
    private final PerformanceDashboardSqlRepository performance = mock(PerformanceDashboardSqlRepository.class);
    private final EscopoFilialService escopo = mock(EscopoFilialService.class);
    private final RedeCredenciadaOperacionalRepository rede =
            new RedeCredenciadaOperacionalRepository(jdbc, performance, escopo);
    private final LocalDate inicio = LocalDate.of(2026, 11, 1);
    private final LocalDate fim = LocalDate.of(2026, 11, 21);

    @Test
    void publicacaoAusenteDistingueSemCoberturaDeZeroArquivamentos() {
        var filtro = new FiltroConsultaDTO(inicio, fim, Map.of());
        var fonte = new PerformanceDashboardSqlRepository.ConsultaEntregas("WITH performance AS (...) ", new MapSqlParameterSource());
        when(performance.entregasDaGestao(eq(filtro), any())).thenReturn(fonte);
        rede.entregas(filtro, null, false);
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        assertThat(sql.getValue()).contains("CAST(NULL AS bigint)", "SUM(f.comprovante_anexado)")
                .doesNotContain("JOIN dbo.rede_credenciada_arquivos");
    }

    @Test
    void restringeArquivamentoAoFimDoPeriodoEUsaEscopoAtual() {
        var filtro = new FiltroConsultaDTO(inicio, fim, Map.of());
        var permitido = EscopoFilialService.EscopoFilial.semAcesso();
        var fonte = new PerformanceDashboardSqlRepository.ConsultaEntregas("WITH performance AS (...) ", new MapSqlParameterSource());
        when(escopo.escopoAtual()).thenReturn(permitido);
        when(performance.entregasDaGestao(filtro, permitido)).thenReturn(fonte);
        rede.entregas(filtro, "ABC | PARCEIRO", true);
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        assertThat(sql.getValue()).contains("a.primeiro_arquivamento < :dataFim", "f.responsavel_regiao_destino = :parceiro",
                "COUNT_BIG(a.minuta)", "f.is_finalizada = 1");
        assertThat(fonte.params().getValue("parceiro")).isEqualTo("ABC | PARCEIRO");
    }

}
