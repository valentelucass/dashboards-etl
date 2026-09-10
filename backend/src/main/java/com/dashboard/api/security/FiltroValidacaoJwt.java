package com.dashboard.api.security;

import com.dashboard.api.repository.acesso.UsuarioSessaoSqlRepository;
import com.dashboard.api.service.acesso.AutenticacaoService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class FiltroValidacaoJwt extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FiltroValidacaoJwt.class);
    private static final int TAMANHO_MAXIMO_ROTA = 100;

    private final GerenciadorTokenJwt gerenciadorToken;
    private final AutenticacaoService autenticacaoService;
    private final UsuarioSessaoSqlRepository usuarioSessaoSqlRepository;

    public FiltroValidacaoJwt(
            GerenciadorTokenJwt gerenciadorToken,
            AutenticacaoService autenticacaoService,
            UsuarioSessaoSqlRepository usuarioSessaoSqlRepository
    ) {
        this.gerenciadorToken = gerenciadorToken;
        this.autenticacaoService = autenticacaoService;
        this.usuarioSessaoSqlRepository = usuarioSessaoSqlRepository;
    }

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);

            if (gerenciadorToken.tokenValido(token)) {
                String usuario = gerenciadorToken.extrairUsuario(token);
                try {
                    var authorities = autenticacaoService.authoritiesFor(usuario);

                    if (!authorities.isEmpty() && SecurityContextHolder.getContext().getAuthentication() == null) {
                        UsernamePasswordAuthenticationToken autenticacao =
                                new UsernamePasswordAuthenticationToken(usuario, null, authorities);

                        SecurityContextHolder.getContext().setAuthentication(autenticacao);
                    }
                    if (!authorities.isEmpty() && !request.getRequestURI().equals("/api/sessao/presenca")) {
                        registrarAtividade(usuario, request);
                    }
                } catch (Exception ex) {
                    log.error("Falha ao carregar permissões para o usuário '{}': {}", usuario, ex.getMessage(), ex);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private void registrarAtividade(String usuario, HttpServletRequest request) {
        try {
            usuarioSessaoSqlRepository.registrarAtividade(usuario, extrairRota(request));
        } catch (Exception ex) {
            log.warn("Falha ao registrar atividade do usuário '{}': {}", usuario, ex.getMessage());
        }
    }

    private String extrairRota(HttpServletRequest request) {
        String rota = normalizarRota(request.getHeader("X-Dashboard-Route"));
        if (rota == null) {
            rota = normalizarRota(request.getRequestURI());
        }
        return rota == null ? "/" : rota;
    }

    private String normalizarRota(String rota) {
        if (rota == null || rota.isBlank()) {
            return null;
        }

        String normalizada = rota.trim();
        int queryIndex = normalizada.indexOf('?');
        if (queryIndex >= 0) {
            normalizada = normalizada.substring(0, queryIndex);
        }
        if (!normalizada.startsWith("/")) {
            return null;
        }
        if (normalizada.length() > TAMANHO_MAXIMO_ROTA) {
            normalizada = normalizada.substring(0, TAMANHO_MAXIMO_ROTA);
        }
        return normalizada;
    }
}
