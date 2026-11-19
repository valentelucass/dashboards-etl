package com.dashboard.api.interceptor;

import com.dashboard.api.exception.RespostaErroHttpWriter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.async.CallableProcessingInterceptor;
import org.springframework.web.context.request.async.WebAsyncUtils;

/** Limita trabalho analítico por instância, antes de adquirir conexões do pool analítico. */
public final class LimiteConsultasAnaliticasInterceptor implements HandlerInterceptor {

    private static final String PERMISSAO = LimiteConsultasAnaliticasInterceptor.class.getName();
    private final Semaphore vagas;
    private final ObjectMapper objectMapper;

    public LimiteConsultasAnaliticasInterceptor(int maxConcorrentes, int tamanhoPool, ObjectMapper objectMapper) {
        if (maxConcorrentes < 1 || tamanhoPool < 1) {
            throw new IllegalArgumentException("Consultas analíticas exigem limite e tamanho de pool positivos.");
        }
        this.vagas = new Semaphore(Math.min(maxConcorrentes, tamanhoPool));
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                             @NonNull Object handler) throws IOException {
        Object mapping = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String path = mapping instanceof String pattern ? pattern
                : request.getRequestURI().substring(request.getContextPath().length());
        boolean leitura = "GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod());
        boolean analitica = path.equals("/api/painel") || path.startsWith("/api/painel/") || path.equals("/api/dimensoes")
                || path.startsWith("/api/dimensoes/");
        if (!leitura || !analitica || path.startsWith("/api/painel/home/")
                || request.getAttribute(PERMISSAO) != null) {
            return true;
        }
        if (!vagas.tryAcquire()) {
            response.setHeader("Retry-After", "2");
            RespostaErroHttpWriter.escrever(response, objectMapper, HttpStatus.SERVICE_UNAVAILABLE,
                    "Service Unavailable", "Consultas analíticas ocupadas. Tente novamente em alguns instantes.");
            return false;
        }
        Permissao permissao = new Permissao();
        request.setAttribute(PERMISSAO, permissao);
        // StreamingResponseBody executa em outra thread. A vaga acompanha o trabalho,
        // mesmo se o cliente desistir antes de a consulta SQL terminar.
        WebAsyncUtils.getAsyncManager(request).registerCallableInterceptor(PERMISSAO, permissao);
        return true;
    }

    @Override
    public void afterCompletion(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                @NonNull Object handler, Exception ex) {
        if (request.getAttribute(PERMISSAO) instanceof Permissao permissao) {
            permissao.concluirRequisicao();
        }
    }

    private final class Permissao implements CallableProcessingInterceptor {
        // 0: síncrona; 1: aguardando executor; 2: trabalho assíncrono ativo; 3: liberada.
        private final AtomicInteger estado = new AtomicInteger();

        @Override
        public <T> void beforeConcurrentHandling(NativeWebRequest request, Callable<T> task) {
            estado.compareAndSet(0, 1);
        }

        @Override
        public <T> void preProcess(NativeWebRequest request, Callable<T> task) {
            if (!estado.compareAndSet(1, 2)) {
                throw new CancellationException("Consulta cancelada antes de iniciar.");
            }
        }

        @Override
        public <T> void postProcess(NativeWebRequest request, Callable<T> task, Object result) {
            liberar();
        }

        @Override
        public <T> void afterCompletion(NativeWebRequest request, Callable<T> task) {
            concluirRequisicao();
        }

        private void concluirRequisicao() {
            int atual = estado.get();
            while (atual < 2) {
                if (estado.compareAndSet(atual, 3)) {
                    vagas.release();
                    return;
                }
                atual = estado.get();
            }
        }

        private void liberar() {
            if (estado.getAndSet(3) != 3) {
                vagas.release();
            }
        }
    }
}
