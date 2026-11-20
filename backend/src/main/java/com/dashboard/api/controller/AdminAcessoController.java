package com.dashboard.api.controller;

import com.dashboard.api.dto.acesso.AuditLogDTO;
import com.dashboard.api.dto.acesso.AuditLogPageDTO;
import com.dashboard.api.dto.acesso.PapelDTO;
import com.dashboard.api.dto.acesso.PermissaoCatalogoItemDTO;
import com.dashboard.api.dto.acesso.SetorDTO;
import com.dashboard.api.dto.acesso.SetorRequestDTO;
import com.dashboard.api.dto.acesso.UsuarioAcessoDTO;
import com.dashboard.api.dto.acesso.UsuarioRequestDTO;
import com.dashboard.api.dto.acesso.UsuarioSessaoResumoDTO;
import com.dashboard.api.model.acesso.AuditLog;
import com.dashboard.api.repository.acesso.AuditLogRepository;
import com.dashboard.api.security.PermissaoCatalogo;
import com.dashboard.api.service.acesso.GestaoSetorService;
import com.dashboard.api.service.acesso.GestaoUsuarioService;
import jakarta.validation.Valid;
import java.sql.SQLException;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/acesso")
@PreAuthorize("@acessoSeguranca.ehAdmin()")
public class AdminAcessoController {

    private final GestaoSetorService gestaoSetorService;
    private final GestaoUsuarioService gestaoUsuarioService;
    private final AuditLogRepository auditLogRepository;

    public AdminAcessoController(
            GestaoSetorService gestaoSetorService,
            GestaoUsuarioService gestaoUsuarioService,
            AuditLogRepository auditLogRepository
    ) {
        this.gestaoSetorService = gestaoSetorService;
        this.gestaoUsuarioService = gestaoUsuarioService;
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping("/catalogo-permissoes")
    public List<PermissaoCatalogoItemDTO> catalogoPermissoes() {
        return PermissaoCatalogo.catalogo();
    }

    @GetMapping("/setores")
    public List<SetorDTO> setores() {
        return gestaoSetorService.listarSetores();
    }

    @PostMapping("/setores")
    public ResponseEntity<SetorDTO> criarSetor(@Valid @RequestBody SetorRequestDTO request) {
        return ResponseEntity.ok(gestaoSetorService.criarSetor(request));
    }

    @PutMapping("/setores/{setorId}")
    public ResponseEntity<SetorDTO> atualizarSetor(
            @PathVariable Long setorId,
            @Valid @RequestBody SetorRequestDTO request) {
        return ResponseEntity.ok(gestaoSetorService.atualizarSetor(setorId, request));
    }

    @DeleteMapping("/setores/{setorId}")
    public ResponseEntity<Void> excluirSetor(@PathVariable Long setorId) {
        gestaoSetorService.excluirSetor(setorId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/usuarios")
    public List<UsuarioAcessoDTO> usuarios() {
        return gestaoUsuarioService.listarUsuarios();
    }

    @GetMapping("/usuarios/resumo-sessoes")
    public UsuarioSessaoResumoDTO resumoSessoesUsuarios() {
        try {
            return gestaoUsuarioService.resumoSessoesUsuarios();
        } catch (DataAccessException ex) {
            if (!(ex.getMostSpecificCause() instanceof SQLException sql) || sql.getErrorCode() != 1205) {
                throw ex;
            }
            // O SQL Server já desfez a transação vítima do deadlock. Releia uma vez em nova transação.
        }
        return gestaoUsuarioService.resumoSessoesUsuarios();
    }

    @PostMapping("/usuarios")
    public ResponseEntity<UsuarioAcessoDTO> criarUsuario(@Valid @RequestBody UsuarioRequestDTO request) {
        return ResponseEntity.ok(gestaoUsuarioService.criarUsuario(request));
    }

    @PutMapping("/usuarios/{usuarioId}")
    public ResponseEntity<UsuarioAcessoDTO> atualizarUsuario(
            @PathVariable Long usuarioId,
            @Valid @RequestBody UsuarioRequestDTO request) {
        return ResponseEntity.ok(gestaoUsuarioService.atualizarUsuario(usuarioId, request));
    }

    @DeleteMapping("/usuarios/{usuarioId}")
    public ResponseEntity<Void> excluirUsuario(@PathVariable Long usuarioId) {
        gestaoUsuarioService.inativarUsuario(usuarioId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/papeis")
    public List<PapelDTO> papeis() {
        return gestaoUsuarioService.listarPapeisDisponiveis();
    }

    @GetMapping("/audit-logs")
    @PreAuthorize("@acessoSeguranca.ehAdminPlataformaOuDesenvolvedor()")
    public ResponseEntity<?> auditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String acao,
            @RequestParam(required = false) Long usuarioId) {

        Pageable pageable = PageRequest.of(page, Math.min(size, 200));
        Page<AuditLog> resultado;

        if (acao != null && usuarioId != null) {
            resultado = auditLogRepository.findByAcaoAndUsuarioIdOrderByTimestampUtcDesc(acao, usuarioId, pageable);
        } else if (acao != null) {
            resultado = auditLogRepository.findByAcaoOrderByTimestampUtcDesc(acao, pageable);
        } else if (usuarioId != null) {
            resultado = auditLogRepository.findByUsuarioIdOrderByTimestampUtcDesc(usuarioId, pageable);
        } else {
            resultado = auditLogRepository.findAllByOrderByTimestampUtcDesc(pageable);
        }

        var content = resultado.getContent().stream()
                .map(log -> new AuditLogDTO(
                        log.getId(),
                        log.getTimestampUtc(),
                        log.getUsuarioLogin(),
                        log.getAcao(),
                        log.getRecurso(),
                        log.getDetalhesJson(),
                        log.getIpAddress()
                ))
                .toList();

        return ResponseEntity.ok(new AuditLogPageDTO(content, resultado.getTotalPages(), resultado.getTotalElements()));
    }
}
