package com.dashboard.api.service.acesso;

import com.dashboard.api.dto.acesso.NavegacaoDiaDTO;
import com.dashboard.api.dto.acesso.PresencaNavegacaoRequest;
import com.dashboard.api.repository.acesso.NavegacaoDiaSqlRepository;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NavegacaoDiaServiceTest {
    private final NavegacaoDiaSqlRepository repository = mock(NavegacaoDiaSqlRepository.class);
    private final UsuarioSupremo supremo = mock(UsuarioSupremo.class);
    private final NavegacaoDiaService service = new NavegacaoDiaService(repository, supremo);
    private static final String FLUXO = "c8b1f094-ea2e-4634-ae42-d6b700c72bfa";

    @Test void registraSomentePaginaConhecidaSemFiltrosOuConteudoPrivado() {
        service.registrar("pessoa@teste.invalid", new PresencaNavegacaoRequest("/cotacoes", true, FLUXO));
        verify(repository).registrar("pessoa@teste.invalid", "/cotacoes", true, FLUXO);
        for (String rota : List.of("/cotacoes?cliente=segredo", "/api/auth/login", "https://site.invalid", "/usuario/123")) {
            assertThrows(IllegalArgumentException.class, () -> service.registrar("pessoa@teste.invalid", new PresencaNavegacaoRequest(rota, true, FLUXO)));
        }
        verifyNoMoreInteractions(repository);
    }

    @Test void recusaSessaoAusenteEConsultaDeOutroAdministrador() {
        assertThrows(AccessDeniedException.class, () -> service.registrar(null, new PresencaNavegacaoRequest("/", true, FLUXO)));
        assertThrows(AccessDeniedException.class, () -> service.buscar("admin@teste.invalid", 1, 0));
        verifyNoInteractions(repository);
    }

    @Test void consultaSupremaDelegaPaginacaoSemAgregarEmMemoria() {
        when(supremo.ehEmailSupremo("supremo@teste.invalid")).thenReturn(true);
        var pagina = new NavegacaoDiaDTO("2026-09-10", 11, List.of());
        when(repository.buscar(7, 1)).thenReturn(pagina);
        assertSame(pagina, service.buscar("supremo@teste.invalid", 7, 1));
        assertThrows(IllegalArgumentException.class, () -> service.buscar("supremo@teste.invalid", 7, -1));
        assertThrows(IllegalArgumentException.class, () -> service.buscar("supremo@teste.invalid", 0, 0));
        verify(repository).buscar(7, 1);
        verifyNoMoreInteractions(repository);
    }

    @Test void perdaDeFocoEncerraVisitaERetencaoEDelegadaAoBanco() {
        service.registrar("pessoa@teste.invalid", new PresencaNavegacaoRequest("/", false, FLUXO));
        verify(repository).registrar("pessoa@teste.invalid", "/", false, FLUXO);
        service.limparDiasAnteriores();
        verify(repository).limparDiasAnteriores();
    }
}
