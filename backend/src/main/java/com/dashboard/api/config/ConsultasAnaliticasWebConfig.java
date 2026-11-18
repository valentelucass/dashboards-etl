package com.dashboard.api.config;

import com.dashboard.api.interceptor.LimiteConsultasAnaliticasInterceptor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ConsultasAnaliticasWebConfig implements WebMvcConfigurer {

    private final LimiteConsultasAnaliticasInterceptor limite;

    public ConsultasAnaliticasWebConfig(ObjectMapper objectMapper,
            @Value("${dashboard.consultas-analiticas.max-concorrentes:3}") int maxConcorrentes,
            @Value("${dashboard.consultas-analiticas.conexoes:3}") int tamanhoPool) {
        limite = new LimiteConsultasAnaliticasInterceptor(maxConcorrentes, tamanhoPool, objectMapper);
    }

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(limite);
    }
}
