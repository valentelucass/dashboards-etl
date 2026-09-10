package com.dashboard.api.controller;

import com.dashboard.api.dto.home.HomeComunicadoDTO;
import com.dashboard.api.dto.home.HomeComunicadoLeituraRequestDTO;
import com.dashboard.api.dto.home.HomeComunicadoRequestDTO;
import com.dashboard.api.dto.home.HomeComunicadoComentarioDTO;
import com.dashboard.api.dto.home.HomeComunicadoComentarioRequestDTO;
import com.dashboard.api.security.AcessoSeguranca;
import com.dashboard.api.service.HomeComunicadoService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/painel/home/comunicados")
public class HomeComunicadoController {

    private final HomeComunicadoService service;
    private final AcessoSeguranca acessoSeguranca;

    public HomeComunicadoController(HomeComunicadoService service, AcessoSeguranca acessoSeguranca) {
        this.service = service;
        this.acessoSeguranca = acessoSeguranca;
    }

    @GetMapping
    public List<HomeComunicadoDTO> listar(Authentication authentication) {
        return service.listarAtivos(usuarioLogin(authentication));
    }

    @PostMapping
    @PreAuthorize("@acessoSeguranca.podeGerenciarHomeComunicados()")
    public ResponseEntity<HomeComunicadoDTO> criar(
            @Valid @RequestBody HomeComunicadoRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(service.criar(request, usuarioLogin(authentication)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@acessoSeguranca.podeGerenciarHomeComunicados()")
    public ResponseEntity<HomeComunicadoDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody HomeComunicadoRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(service.atualizar(id, request, usuarioLogin(authentication)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@acessoSeguranca.podeGerenciarHomeComunicados()")
    public ResponseEntity<Void> arquivar(@PathVariable Long id, Authentication authentication) {
        service.arquivar(id, usuarioLogin(authentication));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/curtidas")
    public ResponseEntity<HomeComunicadoDTO> alternarCurtida(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(service.alternarCurtida(id, usuarioLogin(authentication)));
    }

    @PutMapping("/{id}/leitura")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> registrarLeitura(@PathVariable Long id,
            @Valid @RequestBody HomeComunicadoLeituraRequestDTO request, Authentication authentication) {
        service.registrarLeitura(id, request.versao(), usuarioLogin(authentication));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/comentarios")
    public List<HomeComunicadoComentarioDTO> listarComentarios(@PathVariable Long id, Authentication authentication) {
        return service.listarComentarios(id, usuarioLogin(authentication), acessoSeguranca.ehAdmin());
    }

    @PostMapping("/{id}/comentarios")
    public ResponseEntity<HomeComunicadoComentarioDTO> comentar(
            @PathVariable Long id,
            @Valid @RequestBody HomeComunicadoComentarioRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(service.comentar(id, request, usuarioLogin(authentication)));
    }

    @DeleteMapping("/{id}/comentarios/{comentarioId}")
    public ResponseEntity<Void> excluirComentario(
            @PathVariable Long id,
            @PathVariable Long comentarioId,
            Authentication authentication
    ) {
        service.excluirComentario(id, comentarioId, usuarioLogin(authentication), acessoSeguranca.ehAdmin());
        return ResponseEntity.noContent().build();
    }

    private String usuarioLogin(Authentication authentication) {
        return authentication != null && authentication.getName() != null
                ? authentication.getName()
                : "sistema";
    }
}
