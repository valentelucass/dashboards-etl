package com.dashboard.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashboard.api.exception.ManipuladorGlobalExcecoes;
import com.dashboard.api.interceptor.LimiteConsultasAnaliticasInterceptor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

class ConsultasAnaliticasWebConfigTest {
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void saturacaoAnaliticaRecusaExcessoEPreservaConexaoParaAutenticacao() throws Exception {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:limite-consultas");
        config.setMaximumPoolSize(5);
        config.setConnectionTimeout(1000);
        try (HikariDataSource pool = new HikariDataSource(config)) {
            var controller = new RotasLentas(pool, 3);
            MockMvc mvc = mvc(controller, new LimiteConsultasAnaliticasInterceptor(3, 5, mapper));
            var executor = Executors.newFixedThreadPool(3);
            try {
                var tasks = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
                for (int i = 0; i < 3; i++) {
                    tasks.add(executor.submit(() -> mvc.perform(get("/api/painel/performance/overview"))
                            .andReturn().getResponse().getStatus()));
                }
                assertThat(controller.iniciadas.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(pool.getHikariPoolMXBean().getActiveConnections()).isEqualTo(3);
                var recusada = mvc.perform(get("/api/dimensoes/filiais")).andExpect(status().isServiceUnavailable()).andReturn();
                assertThat(recusada.getResponse().getHeader("Retry-After")).isEqualTo("2");
                mvc.perform(get(java.net.URI.create("/api/%64imensoes/filiais")))
                        .andExpect(status().isServiceUnavailable());
                mvc.perform(post("/api/auth/login")).andExpect(status().isOk());
                mvc.perform(post("/api/auth/refresh")).andExpect(status().isOk());
                mvc.perform(get("/api/auth/me")).andExpect(status().isOk());
                controller.liberar.countDown();
                for (var task : tasks) { assertThat(task.get(5, TimeUnit.SECONDS)).isEqualTo(200); }
                mvc.perform(get("/api/dimensoes/filiais")).andExpect(status().isOk());
                assertThat(pool.getHikariPoolMXBean().getActiveConnections()).isZero();
            } finally {
                controller.liberar.countDown();
                executor.shutdownNow();
                executor.awaitTermination(5, TimeUnit.SECONDS);
            }
        }
    }

    @Test
    void reservaDuasConexoesELiberaVagaAposErro() throws Exception {
        var limite = new LimiteConsultasAnaliticasInterceptor(99, 3, mapper);
        MockMvc mvc = mvc(new RotasRapidas(), limite);
        mvc.perform(get("/api/painel/falha")).andExpect(status().isConflict());
        mvc.perform(get("/api/dimensoes/filiais")).andExpect(status().isOk());
        assertThatThrownBy(() -> new LimiteConsultasAnaliticasInterceptor(3, 2, mapper))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void exportacaoMantemVagaAteTerminarOTrabalhoAssincrono() throws Exception {
        var controller = new ExportacaoLenta();
        var limite = new LimiteConsultasAnaliticasInterceptor(3, 3, mapper);
        MockMvc mvc = mvc(controller, limite);
        var exportacao = mvc.perform(get("/api/painel/coletas/exportacao")).andReturn();
        try {
            assertThat(controller.iniciada.await(5, TimeUnit.SECONDS)).isTrue();
            // Mesmo após conclusão/abandono HTTP, SQL ainda ativo conserva sua vaga.
            limite.afterCompletion(exportacao.getRequest(), exportacao.getResponse(), controller, null);
            mvc.perform(get("/api/dimensoes/filiais")).andExpect(status().isServiceUnavailable());
            controller.liberar.countDown();
            exportacao.getAsyncResult(5000);
            mvc.perform(asyncDispatch(exportacao)).andExpect(status().isOk());
            mvc.perform(get("/api/dimensoes/filiais")).andExpect(status().isOk());
        } finally { controller.liberar.countDown(); }
    }

    private MockMvc mvc(Object controller, LimiteConsultasAnaliticasInterceptor limite) {
        return MockMvcBuilders.standaloneSetup(controller).addInterceptors(limite)
                .setControllerAdvice(new ManipuladorGlobalExcecoes()).build();
    }

    @RestController
    static class RotasRapidas {
        @GetMapping("/api/dimensoes/filiais")
        String dimensoes() { return "ok"; }
        @GetMapping("/api/painel/falha")
        String falha() { throw new IllegalStateException("falha controlada"); }
    }

    @RestController
    static class RotasLentas extends RotasRapidas {
        final HikariDataSource pool;
        final CountDownLatch iniciadas;
        final CountDownLatch liberar = new CountDownLatch(1);
        RotasLentas(HikariDataSource pool, int quantidade) {
            this.pool = pool;
            iniciadas = new CountDownLatch(quantidade);
        }
        @GetMapping("/api/painel/performance/overview")
        String analitica() throws Exception {
            try (var connection = pool.getConnection()) {
                iniciadas.countDown();
                if (!liberar.await(5, TimeUnit.SECONDS)) { throw new IllegalStateException("prazo do teste"); }
                return "ok";
            }
        }
        @PostMapping({"/api/auth/login", "/api/auth/refresh"})
        String autenticar() {
            return new JdbcTemplate(pool).queryForObject("SELECT 'ok'", String.class);
        }
        @GetMapping("/api/auth/me")
        String sessao() { return autenticar(); }
    }

    @RestController
    static class ExportacaoLenta extends RotasRapidas {
        final CountDownLatch iniciada = new CountDownLatch(1);
        final CountDownLatch liberar = new CountDownLatch(1);
        @GetMapping("/api/painel/coletas/exportacao")
        ResponseEntity<StreamingResponseBody> exportacao() {
            return ResponseEntity.ok(output -> {
                iniciada.countDown();
                try {
                    if (!liberar.await(5, TimeUnit.SECONDS)) { throw new IllegalStateException("prazo do teste"); }
                    output.write(1);
                } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            });
        }
    }
}
