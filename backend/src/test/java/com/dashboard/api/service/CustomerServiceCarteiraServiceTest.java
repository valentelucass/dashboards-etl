package com.dashboard.api.service;

import com.dashboard.api.repository.CustomerServiceCarteiraRepository;
import com.dashboard.api.repository.CustomerServiceCarteiraRepository.Mudancas;
import com.dashboard.api.repository.CustomerServiceCarteiraRepository.Revisao;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomerServiceCarteiraServiceTest {
    private final CustomerServiceCarteiraRepository repo = mock(CustomerServiceCarteiraRepository.class);
    private final CustomerServiceCarteiraService service = new CustomerServiceCarteiraService(repo, new ObjectMapper());
    private final Map<String,String> docs = Map.of("12ABC34501DE35","GRUPO");
    private final LocalDate novembro = LocalDate.of(2026,11,1);

    @Test void previaNaoGravaEConfirmaUmaUnicaVez() {
        when(repo.bloquearRevisao()).thenReturn(new Revisao(0, null, null));
        when(repo.comparar(anyString())).thenReturn(new Mudancas(1,1,1,0,0));
        var previa = service.previa(docs, "2026-11");
        verify(repo, never()).substituir(anyString());
        var aplicado = service.aplicar(docs, "2026-11", 0, previa.hashCarteira(), "administrador");
        assertEquals(1, aplicado.versaoAtual());
        assertEquals(1, aplicado.adicionados());
        when(repo.bloquearRevisao()).thenReturn(new Revisao(1, novembro, aplicado.hashCarteira()));
        when(repo.comparar(anyString())).thenReturn(new Mudancas(1,1,0,0,0));
        var repetido = service.aplicar(docs, "2026-11", 0, previa.hashCarteira(), "administrador");
        assertEquals(1, repetido.versaoAtual());
        assertTrue(repetido.semAlteracao());
        verify(repo, times(1)).substituir(anyString());
        verify(repo, times(1)).registrar(aplicado, novembro, "administrador");
    }

    @Test void validaArquivoCompetenciaERevisaoDaPrevia() {
        when(repo.bloquearRevisao()).thenReturn(new Revisao(2, novembro, "anterior"));
        when(repo.comparar(anyString())).thenReturn(new Mudancas(1,1,0,1,1));
        var previa = service.previa(docs, "2026-11");
        assertThrows(IllegalStateException.class, () -> service.aplicar(docs, "2026-11", 1, previa.hashCarteira(), "admin"));
        assertThrows(IllegalStateException.class, () -> service.aplicar(docs, "2026-12", 2, previa.hashCarteira(), "admin"));
        assertThrows(IllegalStateException.class, () -> service.aplicar(Map.of("12ABC34501DE35","OUTRO"),
                "2026-11", 2, previa.hashCarteira(), "admin"));
        assertThrows(IllegalStateException.class, () -> service.previa(docs, "2026-10"));
        for (String mes : new String[]{"2026-13","2026-1","...", "0000-01", null}) {
            assertThrows(IllegalArgumentException.class, () -> service.previa(docs, mes));
        }
        verify(repo, never()).substituir(anyString());
    }

    @Test void confirmaNovoMesComMesmaComposicaoEHashIndependeDaOrdem() {
        var inversa = new LinkedHashMap<String,String>();
        inversa.put("12ABC34501DE35", "GRUPO");
        inversa.put("00101010000113", "GRUPO");
        when(repo.bloquearRevisao()).thenReturn(new Revisao(7, novembro, "anterior"));
        when(repo.comparar(anyString())).thenReturn(new Mudancas(1,2,0,0,0));
        var previa = service.previa(inversa, "2026-12");
        var nova = service.aplicar(new java.util.TreeMap<>(inversa), "2026-12", 7, previa.hashCarteira(), "admin");
        assertTrue(nova.semAlteracao());
        assertEquals(8, nova.versaoAtual());
        verify(repo).registrar(nova, novembro.plusMonths(1), "admin");
    }
}
