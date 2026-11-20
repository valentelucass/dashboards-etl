package com.dashboard.api.repository;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class PerformanceEficienciaTest {
    private static final PerformanceEficiencia.Frete ABERTO = new PerformanceEficiencia.Frete(false, false, null);
    private static final PerformanceEficiencia.Frete FINALIZADO =
            new PerformanceEficiencia.Frete(true, true, LocalDate.of(2026, 11, 18));

    private static PerformanceEficiencia calculo(String de, String ate, String agora) {
        return new PerformanceEficiencia(LocalDate.parse(de), LocalDate.parse(ate), LocalDateTime.parse(agora),
                Set.of(LocalDate.of(2026,11,20)));
    }

    private static PerformanceEficiencia.Evento ev(int codigo, String nf, String hora, String filial) {
        return new PerformanceEficiencia.Evento(codigo, nf, LocalDateTime.parse(hora), filial, codigo == 1);
    }

    @Test void reproduzDoisTransbordosEContaOtifSomenteNoDestino() {
        var c = calculo("2026-11-01", "2026-11-19", "2026-11-19T18:00");
        c.adicionar(FINALIZADO, List.of(
                ev(110,"1","2026-11-09T15:37:53","NHB"), ev(103,"1","2026-11-09T23:59","NHB"),
                ev(102,"1","2026-11-10T16:40","CWB"), ev(103,"1","2026-11-11T00:30","CWB"),
                ev(102,"1","2026-11-11T11:28","SPO"), ev(103,"1","2026-11-12T15:12","SPO"),
                ev(101,"1","2026-11-17T15:48","REC"), ev(55,"1","2026-11-18T07:47:57","REC"),
                ev(1,"1","2026-11-18T18:00","REC")));
        var r = c.resultados();
        assertEquals(List.of("CWB","NHB","REC","SPO"),r.stream().map(x->x.filial()).toList());
        assertEquals(100d,r.get(0).eft()); assertNull(r.get(0).otif());
        assertEquals(100d,r.get(1).efe()); assertEquals(100d,r.get(2).efd()); assertEquals(100d,r.get(2).otif());
        assertEquals(0d,r.get(3).eft()); assertNull(r.get(3).efe());
        assertTrue(r.stream().allMatch(x->x.semInformacao()==0));
    }

    @Test void feriadoNacionalEFimDeSemanaParamRelogioMasFacultativoConta() {
        var h = Set.of(LocalDate.of(2026,11,20));
        assertEquals(Duration.ofHours(14), PerformanceEficiencia.tempoUtil(
                LocalDateTime.parse("2026-11-19T18:00"),LocalDateTime.parse("2026-11-23T08:00"), h));
        assertEquals(Duration.ofHours(24), PerformanceEficiencia.tempoUtil(
                LocalDateTime.parse("2026-02-17T00:00"),LocalDateTime.parse("2026-02-18T00:00"), h));
    }

    @Test void etapaAbertaSoEntraQuandoPassaDoLimiteEFechadaSemSaidaVaiParaSemInformacao() {
        var c = calculo("2026-11-01", "2026-11-19", "2026-11-19T12:00:01");
        c.adicionar(ABERTO, List.of(ev(102,"1","2026-11-18T12:00:00","SPO")));
        c.adicionar(ABERTO, List.of(ev(102,"2","2026-11-18T12:00:01","SPO")));
        c.adicionar(FINALIZADO, List.of(ev(102,"3","2026-11-16T06:00","SPO")));
        c.adicionar(ABERTO, List.of(ev(102,"4","2026-11-17T08:00","SPO"),ev(103,"4","2026-11-18T08:00","SPO")));
        var spo=c.resultados().stream().filter(f->f.filial().equals("SPO")).findFirst().orElseThrow();
        assertEquals(50d,spo.eft());
        assertEquals(1,spo.semInformacao());
    }

    @Test void saidaFracionadaContaUmaVezNaUltimaSaidaECompetenciaDoFim() {
        var c = calculo("2026-11-19", "2026-11-19", "2026-11-19T16:00");
        c.adicionar(ABERTO,List.of(ev(102,"A","2026-11-18T08:00","CWB"),ev(102,"B","2026-11-18T08:00","CWB"),
                ev(103,"A","2026-11-18T12:00","NHB"),ev(103,"B","2026-11-19T08:01","NHB")));
        c.adicionar(ABERTO,List.of(ev(102,"X","2026-11-19T08:00","CWB"),ev(103,"X","2026-11-19T10:00","NHB")));
        assertEquals(1,c.resultados().size());
        assertEquals("NHB",c.resultados().get(0).filial());
        assertEquals(50d,c.resultados().get(0).eft());
    }

    @Test void destinoUsaUltimaChegadaEPrimeiraTentativaDeCadaNota() {
        var c = calculo("2026-11-01", "2026-11-19", "2026-11-19T16:00");
        c.adicionar(ABERTO,List.of(ev(101,"a","2026-11-09T09:00","R"),ev(101,"a","2026-11-12T09:00","R"),
                ev(55,"a","2026-11-13T09:00","R"),ev(55,"a","2026-11-17T10:00","R")));
        assertEquals(100d,c.resultados().get(0).efd());
        var outro = calculo("2026-11-01", "2026-11-19", "2026-11-19T17:00");
        outro.adicionar(ABERTO,List.of(ev(55,"a","2026-11-17T08:00",null)));
        assertEquals(1,outro.resultados().get(0).semInformacao());
        assertNull(outro.resultados().get(0).efd());
    }

    @Test void saidaDeUmaNotaNaoFechaOPercursoDasNotasQueAindaEstaoNoTransbordo() {
        var c = calculo("2026-11-01", "2026-11-19", "2026-11-19T16:00");
        c.adicionar(ABERTO,List.of(ev(102,"A","2026-11-18T08:00","CWB"),ev(102,"B","2026-11-18T08:00","CWB"),
                ev(103,"A","2026-11-18T12:00","NHB")));
        assertEquals(1,c.resultados().size());
        assertEquals("CWB",c.resultados().get(0).filial());
        assertEquals(0d,c.resultados().get(0).eft());
    }

    @Test void retornoAUmMesmoTransbordoGeraDuasPassagensE48HorasExatasNoDestinoSaoEficientes() {
        var c=calculo("2026-11-01","2026-11-19","2026-11-19T18:00");
        c.adicionar(ABERTO,List.of(ev(102,"A","2026-11-09T08:00","SPO"),ev(103,"A","2026-11-09T20:00","SPO"),
                ev(102,"A","2026-11-11T08:00","SPO"),ev(103,"A","2026-11-12T08:00:01","SPO"),
                ev(101,"A","2026-11-16T07:00","REC"),ev(55,"A","2026-11-18T07:00","REC")));
        assertEquals(100d,c.resultados().get(0).efd());
        assertEquals(50d,c.resultados().get(1).eft());
    }
}
