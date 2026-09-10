package com.dashboard.api.service.acesso;

import com.dashboard.api.dto.acesso.NavegacaoDiaDTO;
import com.dashboard.api.dto.acesso.PresencaNavegacaoRequest;
import com.dashboard.api.repository.acesso.NavegacaoDiaSqlRepository;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.util.Set;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NavegacaoDiaService {
    private static final Set<String> ROTAS = Set.of("/", "/coletas", "/manifestos", "/faturamento",
            "/performance", "/tracking", "/faturas-por-cliente", "/contas-a-pagar", "/cotacoes",
            "/indicadores-gestao-a-vista", "/executivo", "/etl-saude", "/painel/integracoes",
            "/admin/usuarios", "/admin/setores");
    private final NavegacaoDiaSqlRepository repository;
    private final UsuarioSupremo supremo;

    public NavegacaoDiaService(NavegacaoDiaSqlRepository repository, UsuarioSupremo supremo) {
        this.repository = repository; this.supremo = supremo;
    }

    @Transactional
    public void registrar(String operador, PresencaNavegacaoRequest request) {
        if (operador == null || operador.isBlank()) throw new AccessDeniedException("Sessão obrigatória.");
        if (!ROTAS.contains(request.rota())) throw new IllegalArgumentException("Página inválida.");
        repository.registrar(operador, request.rota(), request.visivel(), request.fluxoId());
    }

    @Transactional(readOnly = true)
    public NavegacaoDiaDTO buscar(String operador, long usuarioId, int pagina) {
        if (!supremo.ehEmailSupremo(operador)) throw new AccessDeniedException("Consulta restrita.");
        if (usuarioId <= 0 || pagina < 0) throw new IllegalArgumentException("Página ou usuário inválido.");
        return repository.buscar(usuarioId, pagina);
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 0 * * *", zone = "America/Sao_Paulo")
    public void limparDiasAnteriores() { repository.limparDiasAnteriores(); }
}
