package com.dashboard.api.controller;

import com.dashboard.api.dto.acesso.NavegacaoDiaDTO;
import com.dashboard.api.dto.acesso.PresencaNavegacaoRequest;
import com.dashboard.api.service.acesso.NavegacaoDiaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class PresencaNavegacaoController {
    private final NavegacaoDiaService service;
    public PresencaNavegacaoController(NavegacaoDiaService service) { this.service = service; }

    @PutMapping("/api/sessao/presenca")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> registrar(Authentication authentication, @Valid @RequestBody PresencaNavegacaoRequest request) {
        service.registrar(authentication.getName(), request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/admin/acesso/usuarios/{usuarioId}/navegacao-dia")
    @PreAuthorize("@acessoSeguranca.ehAdmin() and @usuarioSupremo.ehEmailSupremo(authentication.name)")
    public NavegacaoDiaDTO buscar(Authentication authentication, @PathVariable long usuarioId,
                                  @RequestParam(defaultValue = "0") int pagina) {
        return service.buscar(authentication.getName(), usuarioId, pagina);
    }
}
