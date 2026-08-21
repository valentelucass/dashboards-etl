package com.dashboard.api.security;

import com.dashboard.api.exception.RespostaErroHttpWriter;
import com.dashboard.api.model.acesso.AcaoAudit;
import com.dashboard.api.service.acesso.AuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class FiltroRateLimitApi extends OncePerRequestFilter {

    private static final List<String> PREFIXOS_LIMITADOS = List.of(
            "/api/painel/coletas",
            "/api/painel/contas-a-pagar",
            "/api/painel/cotacoes",
            "/api/dimensoes",
            "/api/kpi-goals",
            "/api/painel/etl-saude",
            "/api/painel/executivo",
            "/api/painel/faturas-por-cliente",
            "/api/painel/fretes",
            "/api/painel/home/comunicados",
            "/api/painel/home/solicitacoes",
            "/api/painel/indicadores-gestao-a-vista",
            "/api/painel/integracoes",
            "/api/painel/manifestos",
            "/api/painel/performance",
            "/api/painel/tracking",
            "/api/admin/acesso"
    );

    private final RateLimitService rateLimitService;
    private final AuditService auditService;
    private final IpClienteResolver ipClienteResolver;
    private final ObjectMapper objectMapper;

    public FiltroRateLimitApi(
            RateLimitService rateLimitService,
            AuditService auditService,
            IpClienteResolver ipClienteResolver,
            ObjectMapper objectMapper
    ) {
        this.rateLimitService = rateLimitService;
        this.auditService = auditService;
        this.ipClienteResolver = ipClienteResolver;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return PREFIXOS_LIMITADOS.stream().noneMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String principal = principalAtual();
        String identificador = request.getRequestURI() + ":" + ipClienteResolver.resolver(request) + ":" + principal;
        boolean exportacao = ehExportacao(request.getRequestURI());
        RateLimitService.RateLimitDecision decisao = exportacao
                ? rateLimitService.consumirExportacao(identificador)
                : rateLimitService.consumirChamadaApi(identificador);

        if (!decisao.permitido()) {
            auditService.registrarSync(
                    AcaoAudit.RATE_LIMIT_EXCEDIDO,
                    null,
                    principal,
                    request.getRequestURI(),
                    "{\"janelaRequests\":" + decisao.totalNaJanela() + "}"
            );
            response.setHeader("Retry-After", String.valueOf(decisao.retryAfterSeconds()));
            RespostaErroHttpWriter.escrever(
                    response,
                    objectMapper,
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too Many Requests",
                    exportacao
                            ? "Limite temporário de exportações excedido."
                            : "Limite temporário de requisições excedido."
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String principalAtual() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return "anon";
        }
        return authentication.getName();
    }

    private boolean ehExportacao(String path) {
        return path.endsWith("/exportacao") || path.endsWith("/exportacao-financeira");
    }
}
